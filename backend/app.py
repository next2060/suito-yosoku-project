from flask import Flask, request, jsonify
from flask_cors import CORS
from prediction_logic import run_prediction

# Flaskアプリケーションの初期化
app = Flask(__name__)

# CORS (Cross-Origin Resource Sharing) を有効にする
# これにより、異なるドメインで動作するReactアプリからのリクエストを受け付けられるようになる
CORS(app)

@app.route('/')
def index():
    return "生育予測APIサーバーが起動しています。", 200

@app.route('/predict', methods=['POST'])
def predict():
    """
    ReactアプリからPOSTリクエストを受け取り、予測を実行して結果を返すAPIエンドポイント
    """
    # リクエストのボディからJSONデータを取得
    data = request.get_json()
    if not data:
        return jsonify({"error": "リクエストの形式が正しくありません。"}), 400

    # 必要なキーが存在するかチェック
    required_keys = ['lat', 'lon', 'transplantDate', 'variety']
    if not all(key in data for key in required_keys):
        return jsonify({"error": "緯度、経度、移植日、品種のデータが必要です。"}), 400

    lat = data['lat']
    lon = data['lon']
    transplant_date = data['transplantDate']
    variety = data['variety']
    
    # 認証情報をリクエストから取得（存在しない場合はNoneになる）
    weather_user = data.get('weatherUser')
    weather_pass = data.get('weatherPassword')

    # 受け取った品種名をターミナルに表示してデバッグ
    print(f"--- フロントエンドから受信した品種名: '{variety}' ---")
    if weather_user:
        print(f"--- 気象APIユーザー名: '{weather_user}' ---")


    # 予測ロジックを実行
    try:
        # 認証情報を追加して予測関数を呼び出し
        prediction_result = run_prediction(lat, lon, transplant_date, variety, weather_user, weather_pass)
        if "error" in prediction_result:
            # 予測ロジック内でエラーが発生した場合
            return jsonify(prediction_result), 400
        
        return jsonify(prediction_result), 200

    except Exception as e:
        print(f"サーバー内部エラー: {e}")
        return jsonify({"error": "サーバー内部で予期せぬエラーが発生しました。"}), 500

if __name__ == '__main__':
    # デバッグモードでサーバーを起動
    # ポート5001を使用 (Reactアプリが3000を使っているため)
    app.run(debug=True, port=5001)
