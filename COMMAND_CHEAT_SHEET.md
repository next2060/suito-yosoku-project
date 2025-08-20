# 水稲生育予測システム 運用コマンド一覧

このファイルは、開発や更新でよく使うコマンドをまとめたものです。

---

## 1. ローカル開発サーバーの起動

**注意:** バックエンドとフロントエンドは、それぞれ別のPowerShellウィンドウで実行する必要があります。

### バックエンドサーバー (Python/Flask)
```powershell
# Pythonの仮想環境を使ってAPIサーバーを起動します (ポート5001)
C:\Users\kinni\suito-yosoku-project\backend\venv\Scripts\python.exe C:\Users\kinni\suito-yosoku-project\backend\app.py
```

### フロントエンドサーバー (React)
```powershell
# Reactの開発サーバーを起動します (http://localhost:3000)
npm start --prefix C:\Users\kinni\suito-yosoku-project\frontend
```

---

## 2. サーバーへのファイルアップロード

### 単一ファイルのアップロード (例: QGISプロジェクトファイル)
```powershell
# ローカルのファイルをサーバーの指定した場所にアップロードします
# 例: main_only_Paddy_field.qgs をアップロードする場合
scp -i "C:\Users\kinni\aws\QGIS-SERVER-KEY.pem" "C:\Users\kinni\suito-yosoku-project\qgis_projects\main_only_Paddy_field.qgs" ubuntu@54.252.200.4:/home/ubuntu/my_qgis_projects/
```

### 複数JSONファイルの一括アップロード
```powershell
# qgis_projects フォルダ内の全JSONファイルを一括でサーバーにアップロードします
$localDir = "C:\Users\kinni\suito-yosoku-project\qgis_projects"
$remoteDir = "/home/ubuntu/qgis-server-simple/projects/"
$sshKey = "C:\Users\kinni\aws\QGIS-SERVER-KEY.pem"
$serverUser = "ubuntu"
$serverHost = "54.252.200.4"

$jsonFiles = Get-ChildItem -Path $localDir -Filter *.json

foreach ($file in $jsonFiles) {
    Write-Host "Uploading $($file.Name)..."
    scp -i $sshKey $file.FullName "$($serverUser)@$($serverHost):$($remoteDir)"
    if ($?) {
        Write-Host "$($file.Name) uploaded successfully." -ForegroundColor Green
    } else {
        Write-Host "Error uploading $($file.Name)." -ForegroundColor Red
    }
}

Write-Host "All JSON files have been processed."
```

---

## 3. QGISサーバーの再起動 (AWS EC2)

サーバー上の設定ファイルやデータを更新した後に実行します。

```powershell
# 1. サーバーにSSHで接続
ssh -i "C:\Users\kinni\aws\QGIS-SERVER-KEY.pem" ubuntu@54.252.200.4
```
```bash
# 2. (接続後) ディレクトリを移動
cd ~/qgis-server-simple

# 3. (ディレクトリ移動後) コンテナを強制的に再作成して起動
docker compose up -d --force-recreate
```

## 4. gemini起動
"C:UserskinniDocumentsgemini_historyQGIS Server 水稲生育予測システムの概要.txt"システム構築を支援してください。作業履歴確認のためC:\Users\kinni\Documents\gemini_history内のファイルをすべて確認してください。   
