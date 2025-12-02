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
      // 1. 載入 AI 模型 (保持 CDN 方式)
      setStatusMsg('步驟 1/3: 下載 AI 模型...')
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
      )

      handLandmarkerRef.current = await HandLandmarker.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        }
      )

      // 2. 啟動攝像頭
      setStatusMsg('步驟 2/3: 啟動影像...')
      
      // ⚠️ 修正 A: 移除所有寬高限制，讓 iOS 自由發揮，避免卡住
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }, 
        audio: false 
      })

      setStatusMsg('步驟 3/3: 處理畫面中...')

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        
        // ⚠️ 修正 B: iOS 必須明確呼叫 play()
        await videoRef.current.play()
        
        // ⚠️ 修正 C: 不等待 onloadeddata 事件，直接強制開始預測
        // 為了保險，延遲 500ms 讓相機熱身
        setTimeout(() => {
           setStatusMsg('') // 清除訊息
           predictWebcam()
        }, 500)
      }

    } catch (error) {
      console.error(error)
      setStatusMsg(`❌ 錯誤: ${error.message || error}`)
      setIsStarted(false)
    }
  }

  const predictWebcam = () => {
    // 確保影片有在跑，且寬高大於 0
    if (handLandmarkerRef.current && videoRef.current && videoRef.current.videoWidth > 0) {
      const results = handLandmarkerRef.current.detectForVideo(videoRef.current, Date.now())

      if (results.landmarks && results.landmarks.length > 0) {
        const hand = results.landmarks[0]
        const indexTip = hand[8]
        const thumbTip = hand[4]
        
        // 座標計算
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
    // 即使沒檢測到，也要持續呼叫下一幀
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
      {/* ⚠️ 修正 D: 騙過 Safari 的關鍵樣式 
         不要用 width: 1px, 不要用 opacity: 0
         改成全螢幕大小，但是放在 z-index: -1 (被畫布蓋住)
         這樣 Safari 才會認為這是一個「重要」的影片而開始渲染
      */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          objectFit: 'cover',
          zIndex: -1, // 藏在最後面
          // opacity: 0.1, // 如果還不行，可以打開這一行試試，讓它微微可見
        }}
      />

      {!isStarted && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999
        }}>
          <button 
            onClick={startCamera}
            style={{
              padding: '15px 30px', fontSize: '20px', cursor: 'pointer',
              background: '#00ffff', border: 'none', borderRadius: '50px',
              boxShadow: '0 0 20px #00ffff', color: '#000', fontWeight: 'bold'
            }}
          >
            {statusMsg && statusMsg.includes("❌") ? "再試一次" : "✨ 啟動魔法 (iOS Fix)"}
          </button>
          
          {statusMsg && statusMsg.includes("❌") && (
            <div style={{color: '#ff5555', marginTop: '20px', padding: '10px'}}>{statusMsg}</div>
          )}
        </div>
      )}

      {isStarted && statusMsg && !statusMsg.includes("❌") && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          color: '#00ffff', fontSize: '18px', zIndex: 9998, background: 'rgba(0,0,0,0.6)', padding: '15px', borderRadius: '10px'
        }}>
          {statusMsg}
        </div>
      )}
    </>
  )
}