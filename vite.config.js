import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // ⚠️ 注意：這裡的名字必須跟你在 GitHub 上建立的倉庫名稱一模一樣！
  // 並且前後都要有斜線 '/'
  base: '/magic-particles/', 
})