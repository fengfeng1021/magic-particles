// src/components/Webcam/HandTracker.jsx
import { useEffect, useRef, useState } from 'react'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

// 輔助函數：更嚴謹的手指計數
function countFingers(landmarks) {
  let count = 0
  // 拇指：比較指尖和指節的 X 軸距離
  const thumbTip = landmarks[4]
  const thumbIp = landmarks[3] // 拇指指節
  const thumbMcp = landmarks[2] // 拇指根部
  
  // 簡單判斷：如果指尖離手掌中心的距離 > 指節離中心的距離，算伸出
  // 這裡使用更簡單的 X 軸判斷 (適用於手掌正面對鏡頭)
  if (Math.abs(thumbTip.x - thumbMcp.x) > Math.abs(thumbIp.x - thumbMcp.x)) {
    count++
  }

  // 其他四指：比較指尖 (Tip) 和指節 (PIP - 第二關節) 的 Y 軸
  // 注意：MediaPipe 的 Y 軸向下是正，所以指尖數值越小代表越高
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
  // 新增：用於顯示當前偵測到的手勢數字 (Debug UI)
  const [detectedGesture, setDetectedGesture] = useState("無")

  const startCamera = async () => {
    setIsStarted(true)
    try {
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
          numHands: 2,
        }
      )

      setStatusMsg('步驟 2/3: 啟動影像...')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }, 
        audio: false 
      })

      setStatusMsg('步驟 3/3: 處理畫面中...')

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setTimeout(() => {
           setStatusMsg('') 
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
        const handsData = []
        let maxGestureStr = ""

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
          
          const fingerCount = countFingers(hand)
          
          // 更新 UI 顯示文字
          maxGestureStr += `[${fingerCount}] `

          handsData.push({ x, y, isPinching, gesture: fingerCount })
        }
        
        setDetectedGesture(maxGestureStr)
        onHandUpdate(handsData)
      } else {
        setDetectedGesture("無")
        onHandUpdate([])
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
        style={{ 
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
          objectFit: 'cover', zIndex: -1, 
        }}
      />

      {/* DEBUG UI: 顯示偵測到的數字，讓你確認手勢是否正確 */}
      {isStarted && !statusMsg && (
        <div style={{
            position: 'absolute', bottom: '20px', left: '20px', 
            color: '#00ff00', fontSize: '24px', fontWeight: 'bold', 
            zIndex: 9999, textShadow: '0 0 5px black', fontFamily: 'monospace'
        }}>
            手勢數字: {detectedGesture}
        </div>
      )}

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
            {statusMsg && statusMsg.includes("❌") ? "再試一次" : "✨ 啟動魔法"}
          </button>
          {statusMsg && <div style={{color: 'white', marginTop: '20px'}}>{statusMsg}</div>}
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