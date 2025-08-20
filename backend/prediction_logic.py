import pandas as pd
import numpy as np
import datetime
import xarray as xr
import AMD_Tools4 as amd
from AMD_DayLength3 import daylength
import firebase_admin
from firebase_admin import credentials, firestore

# --- Firebase Admin SDKの初期化 ---
try:
    cred = credentials.Certificate("firebase-adminsdk.json")
    firebase_admin.initialize_app(cred)
    db = firestore.client()
except Exception as e:
    if "already exists" not in str(e):
        print(f"Firebase Admin SDKの初期化に失敗しました: {e}") # このエラーは重要なので残す
    else:
        db = firestore.client()

# --- 品種パラメータ ---
VARIETY_GROWTH_UNITS = {
    'あきたこまち': {
        'gv': 59.72169003, 'th': 17.92691271, 'lc': 74.34339884,
        'a': 0.19704426, 'b': 0.237730837, 'tmax': 996
    },
    'コシヒカリ': {
        'gv': 60.41674238, 'th': 19.71495705, 'lc': 27.53725723,
        'a': 0.140590405, 'b': 1.519181792, 'tmax': 1046
    },
    'にじのきらめき': {
        'gv': 70.75454085, 'th': 18.76623796, 'lc': 39.9851766,
        'a': 0.270536814, 'b': 0.722104104, 'tmax': 1154
    },
}

# --- 新しい品種パラメータ取得関数 ---
def get_variety_params(variety_name):
    if variety_name in VARIETY_GROWTH_UNITS:
        params = VARIETY_GROWTH_UNITS[variety_name].copy()
        params['Adj'] = 0
        params['DVS'] = 0.2158205
        return params
    else:
        try:
            varieties_ref = db.collection('varieties')
            query = varieties_ref.where('name', '==', variety_name).limit(1).stream()
            for doc in query:
                custom_variety_data = doc.to_dict()
                base_variety_name = custom_variety_data.get('baseVariety')
                if base_variety_name in VARIETY_GROWTH_UNITS:
                    params = VARIETY_GROWTH_UNITS[base_variety_name].copy()
                    params['Adj'] = custom_variety_data.get('adjustmentDays', 0)
                    params['tmax'] = custom_variety_data.get('ripeningAccumulatedTemp', 1000)
                    params['DVS'] = 0.2158205
                    return params
            return None
        except Exception as e:
            # サーバーログにはエラーを残すのが望ましい
            print(f"Firestoreからの品種データ取得中にエラー: {e}")
            return None

# --- DVR計算式 ---
def DVR(gv, lc, th, a, b, T, L):
    return (1/gv)*(1-np.exp(b*(L-lc)))/(1+np.exp(-a*(T-th)))

# --- API用のメイン関数 ---
def run_prediction(lat, lon, transplant_date_str, variety, username, password):
    try:
        transplant_date = pd.to_datetime(transplant_date_str)
    except Exception as e:
        return {"error": f"日付形式エラー: {e}"}

    if username and password:
        amd.set_credentials(username, password)

    try:
        start_date = transplant_date.strftime('%Y-%m-%d')
        end_date = (transplant_date + pd.Timedelta(days=200)).strftime('%Y-%m-%d')
        timedomain = [start_date, end_date]
        margin = 0.1
        lalodomain = [lat - margin, lat + margin, lon - margin, lon + margin]
        
        data_T, tim, lat_arr, lon_arr  = amd.GetMetData('TMP_mea', timedomain, lalodomain)
        if data_T is None:
            return {"error": "気象データの取得に失敗しました。ユーザー名またはパスワードが正しくない可能性があります。"}

        data_L = daylength(tim, lat_arr, lon_arr)
        mdarr_T = xr.DataArray(data_T, dims=['time','lat','lon'], coords={'time':tim, 'lat':lat_arr, 'lon':lon_arr})
        mdarr_L = xr.DataArray(data_L, dims=['time','lat','lon'], coords={'time':tim, 'lat':lat_arr, 'lon':lon_arr})
        Tarr = mdarr_T.sel(lat=lat, lon=lon, method='nearest')
        Larr = mdarr_L.sel(lat=lat, lon=lon, method='nearest')

    except ValueError as e:
        if "Network error found" in str(e):
            return {"error": "気象データの取得に失敗しました。ユーザー名またはパスワードが正しくない可能性があります。"}
        else:
            return {"error": f"予期せぬ値エラーが発生しました: {e}"}
    except Exception as e:
        return {"error": f"気象データの取得または処理に失敗しました: {e}"}

    variety_params = get_variety_params(variety)
    if variety_params is None:
        return {"error": f"品種「{variety}」のパラメータが見つかりません。"}
    
    gv, th, lc = variety_params['gv'], variety_params['th'], variety_params['lc']
    a, b, tmax = variety_params['a'], variety_params['b'], variety_params['tmax']
    Adj = variety_params['Adj']
    DVS = variety_params['DVS']
    
    tsum = 0.0
    heading_date = None
    maturity_date = None
    use_DVS = True
    
    for i, (Ti, Li) in enumerate(zip(Tarr.data, Larr.data)):
        current_date = pd.to_datetime(Tarr.time[i].data)
        if use_DVS:
            dvr_val = DVR(gv, lc, th, a, b, Ti, Li)
            DVS += dvr_val
            if DVS > 1.0:
                use_DVS = False
                adjusted_date = current_date + pd.Timedelta(days=Adj)
                heading_date = adjusted_date.strftime('%Y-%m-%d')
        else:
            tsum += Ti
            if tsum > tmax:
                maturity_date = current_date.strftime('%Y-%m-%d')
                break
    
    return {
        "heading_date": heading_date or "予測不能",
        "maturity_date": maturity_date or "予測不能"
    }


