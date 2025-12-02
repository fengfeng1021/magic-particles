// src/components/Webcam/HandTracker.jsx
import { useEffect, useRef, useState } from 'react'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

// 輔助函數：計算伸出的手指數量
function countFingers(landmarks) {
  let count = 0
  // 手指指尖 (Tip) 與 指節 (PIP) 的索引對照
  // 拇指(4,2), 食指(8,6), 中指(12,10), 無名指(16,14), 小指(20,17)
  
  // 1. 拇指判斷 (X軸差異)
  // 右手拇指在左邊，左手拇指在右邊，這裡做簡單判斷
  if (Math.abs(landmarks[4].x - landmarks[2].x) > 0.05) count++

  // 2. 其他四指判斷 (Y軸高度，指尖比指節高)
  if (landmarks[8].y < landmarks[6].y) count++  // 食指
  if (landmarks[12].y < landmarks[10].y) count++ // 中指
  if (landmarks[16].y < landmarks[14].y) count++ // 無名指
  if (landmarks[20].y < landmarks[17].y) count++ // 小指

  return count
}

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
          numHands: 2, // 開啟雙手追蹤
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
    if (handLandmarkerRef.current && videoRef.current && videoRef.current.videoWidth > 0) {
      const results = handLandmarkerRef.current.detectForVideo(videoRef.current, Date.now())

      if (results.landmarks && results.landmarks.length > 0) {
        // 準備一個陣列來存所有偵測到的手
        const handsData = []

        for (const hand of results.landmarks) {
          const indexTip = hand[8]
          const thumbTip = hand[4]
          
          const x = (0.5 - indexTip.x) 
          const y = -(indexTip.y - 0.5) 

          const distance = Math.sqrt(
            Math.pow(indexTip.x - thumbTip.x, 2) + 
            Math.pow(indexTip.y - thumbTip.y, 2)
          )
          const isPinching = distance < 0.1
          
          // 新增：計算這隻手比出的數字
          const fingerCount = countFingers(hand)

          handsData.push({ x, y, isPinching, gesture: fingerCount })
        }

        onHandUpdate(handsData) // 回傳陣列
      } else {
        onHandUpdate([]) // 回傳空陣列而不是 null
      }
    }
    // 持續呼叫
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