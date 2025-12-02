// src/components/Webcam/HandTracker.jsx
import { useEffect, useRef, useState } from 'react'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

export default function HandTracker({ onHandUpdate }) {
  const videoRef = useRef(null)
  const handLandmarkerRef = useRef(null)
  const animationFrameId = useRef(null)
  
  const [isStarted, setIsStarted] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  const startCamera = async () => {
    setIsStarted(true)
    
    try {
      // --- 階段 1: 測試瀏覽器支援度 ---
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("您的瀏覽器不支援攝像頭 API (navigator.mediaDevices is missing)")
      }

      // --- 階段 2: 載入 AI 模型 ---
      setStatusMsg('步驟 1/3: 下載 AI 模型...')
      console.log('正在載入 WASM:', import.meta.env.BASE_URL + 'models/vision_wasm_internal.wasm')
      
      const vision = await FilesetResolver.forVisionTasks(
        import.meta.env.BASE_URL + 'models/vision_wasm_internal.wasm'
      )

      handLandmarkerRef.current = await HandLandmarker.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: 'CPU', // iOS 必須用 CPU
          },
          runningMode: 'VIDEO',
          numHands: 1,
        }
      )

      // --- 階段 3: 啟動攝像頭 (最簡化配置) ---
      setStatusMsg('步驟 2/3: 等待攝像頭授權...')
      
      // ⚠️ 修正：iOS 有時候對 width/height 限制很敏感，我們先用最基本的 { video: true } 確保能跑
      // 使用 facingMode: 'user' 指定前鏡頭
      const constraints = { 
        video: { facingMode: 'user' }, 
        audio: false 
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      
      setStatusMsg('步驟 3/3: 啟動影像串流...')

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        // iOS 必須顯式調用 play
        await videoRef.current.play()
        
        videoRef.current.onloadeddata = () => {
          setStatusMsg('') // 成功！清除訊息
          predictWebcam()
        }
      }

    } catch (error) {
      console.error("詳細錯誤:", error)
      
      // 🕵️‍♂️ 錯誤偵探：嘗試解析各種奇怪的錯誤格式
      let errorText = "未知錯誤"
      if (typeof error === 'string') {
        errorText = error
      } else if (error instanceof Error) {
        errorText = `${error.name}: ${error.message}`
      } else {
        // 嘗試轉成 JSON，如果不行就轉字串
        try {
          errorText = JSON.stringify(error)
        } catch (e) {
          errorText = String(error)
        }
      }
      
      // 如果是特定的常見錯誤，給予白話文提示
      if (errorText.includes("NotAllowedError") || errorText.includes("Permission denied")) {
        errorText = "權限被拒絕。請到 iOS 設定 > Safari > 相機，改為「允許」。"
      }
      
      setStatusMsg(`❌ 失敗: ${errorText}`)
      setIsStarted(false) // 允許重試
    }
  }

  // ... (predictWebcam 和 useEffect 保持不變，照舊) ...
  const predictWebcam = () => {
    if (handLandmarkerRef.current && videoRef.current && videoRef.current.readyState === 4) {
      const results = handLandmarkerRef.current.detectForVideo(videoRef.current, Date.now())

      if (results.landmarks && results.landmarks.length > 0) {
        const hand = results.landmarks[0]
        const indexTip = hand[8]
        const thumbTip = hand[4]
        
        const x = (0.5 - indexTip.x) * 2 
        const y = -(indexTip.y - 0.5) * 2

        const distance = Math.sqrt(
          Math.pow(indexTip.x - thumbTip.x, 2) + 
          Math.pow(indexTip.y - thumbTip.y, 2)
        )
        const isPinching = distance < 0.1

        onHandUpdate({ x, y, isPinching })
      } else {
        onHandUpdate(null)
      }
    }
    animationFrameId.current = requestAnimationFrame(predictWebcam)
  }

  useEffect(() => {
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current)
      if (handLandmarkerRef.current) handLandmarkerRef.current.close()
    }
  }, [])

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '1px', height: '1px', opacity: 0, position: 'absolute' }}
      />

      {!isStarted && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, padding: '20px', textAlign: 'center'
        }}>
          <button 
            onClick={startCamera}
            style={{
              padding: '15px 30px', fontSize: '20px', cursor: 'pointer',
              background: '#00ffff', border: 'none', borderRadius: '50px',
              boxShadow: '0 0 20px #00ffff', color: '#000', fontWeight: 'bold', marginBottom: '20px'
            }}
          >
            {statusMsg && statusMsg.includes("❌") ? "再試一次" : "✨ 啟動魔法"}
          </button>
          
          {/* 顯示紅色的錯誤訊息 */}
          {statusMsg && statusMsg.includes("❌") && (
            <div style={{color: '#ff5555', background: 'rgba(50,0,0,0.8)', padding: '10px', borderRadius: '5px'}}>
              {statusMsg}
            </div>
          )}
        </div>
      )}

      {/* 顯示載入中的藍色訊息 */}
      {isStarted && statusMsg && !statusMsg.includes("❌") && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          color: '#00ffff', fontSize: '18px', zIndex: 9998, background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '10px'
        }}>
          {statusMsg}
        </div>
      )}
    </>
  )
}