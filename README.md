# AeroGuitar 公開版

GitHub 儲存庫中的 `data/songs.csv` 是曲庫來源。每次把更新提交到 `main`，GitHub Actions 會驗證 CSV，重新產生網站並部署。曲庫需要的欄位會隨網站公開。

## 首次部署

1. 將整個專案（含隱藏的 `.github` 資料夾）提交到 GitHub 儲存庫的 `main` 分支。
2. 在儲存庫的 Settings → Pages → Build and deployment → Source 選 GitHub Actions。
3. 到 Actions 執行「Build and deploy AeroGuitar」。成功後在 Pages 查看網站網址。

## 更新曲庫

替換 `data/songs.csv`，保留表頭。建議使用 UTF-8，匯入程式也支援 CP950。以 `AG Chord` 儲存和弦類別，使用英文分號分隔多個類別。藝人、歌手或音樂人填在 `Artists`。保留既有曲目的 ID，新增曲目應使用新 ID。提交後在 Actions 查看部署結果。CSV 驗證失敗時，流程會顯示出錯行號並停止部署。

本機可執行 `python3 build.py` 建置。GitHub Pages 版的練習清單由瀏覽器依網址儲存。
