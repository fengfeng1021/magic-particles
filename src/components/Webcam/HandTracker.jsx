// src/components/Webcam/HandTracker.jsx
import { useEffect, useRef, useState } from 'react'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

export default function HandTracker({ onHandUpdate }) {
  const videoRef = useRef(null)
  const handLandmarkerRef = useRef(null)
  const animationFrameId = useRef(null)
  
  // 新增狀態：是否已經啟動
  const [isStarted, setIsStarted] = useState(false)
  // 新增狀態：載入訊息或錯誤
  const [statusMsg, setStatusMsg] = useState('')

  // 這是啟動函數，必須由按鈕觸發
  const startCamera = async () => {
    setIsStarted(true)
    setStatusMsg('正在初始化魔法引擎 (AI Loading)...')

    try {
      // 1. 載入 AI 模型
      // 注意：這裡保留了上次修正的路徑寫法
      const vision = await FilesetResolver.forVisionTasks(
        import.meta.env.BASE_URL + 'models/vision_wasm_internal.wasm'
      )

      handLandmarkerRef.current = await HandLandmarker.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: 'CPU', // 保持 CPU 以確保 iPad 相容性
          },
          runningMode: 'VIDEO',
          numHands: 1,
        }
      )

      // 2. 請求攝像頭 (這行在 iOS 上必須由點擊觸發)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user', // 前置鏡頭
          width: { ideal: 640 }, // 使用 ideal 參數比較彈性
          height: { ideal: 480 },
        },
        audio: false, // 絕對不要請求 audio，否則會有雜音或權限更嚴格
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        // 確保影片播放 (iOS 關鍵)
        videoRef.current.play()
        
        videoRef.current.onloadeddata = () => {
          setStatusMsg('') // 清除訊息
          predictWebcam()
        }
      }
    } catch (error) {
      console.error(error)
      setStatusMsg(`啟動失敗: ${error.message}. 請檢查權限設定。`)
      setIsStarted(false) // 失敗後允許再次點擊
    }
  }

  // 檢測迴圈 (保持不變)
  const predictWebcam = () => {
    if (handLandmarkerRef.current && videoRef.current && videoRef.current.readyState === 4) {
      const results = handLandmarkerRef.current.detectForVideo(videoRef.current, Date.now())

      if (results.landmarks && results.landmarks.length > 0) {
        const hand = results.landmarks[0]
        const indexTip = hand[8]
        const thumbTip = hand[4]
        
        // 修正：增加座標鏡像翻轉 (Mirror)，這樣手往左移，畫面粒子也會往左
        // 原本 x 是 (indexTip.x - 0.5) * 2，現在加個負號或調整運算
        // MediaPipe 預設也是鏡像的，我們微調一下 X 軸方向
        const x = (0.5 - indexTip.x) * 2 // 翻轉 X 軸方向，操作更直覺
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

  // 清理
  useEffect(() => {
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current)
      if (handLandmarkerRef.current) handLandmarkerRef.current.close()
    }
  }, [])

  return (
    <>
      {/* 隱藏的 Video 元素 (必須加上 playsInline) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline // ⚠️ iOS 絕對關鍵屬性：禁止自動全螢幕
        muted       // ⚠️ iOS 絕對關鍵屬性：靜音才能自動播放
        style={{ width: '1px', height: '1px', opacity: 0, position: 'absolute' }}
      />

      {/* 如果還沒啟動，顯示一個覆蓋層按鈕 */}
      {!isStarted && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999
        }}>
          <button 
            onClick={startCamera}
            style={{
              padding: '15px 30px', fontSize: '24px', cursor: 'pointer',
              background: '#00ffff', border: 'none', borderRadius: '50px',
              boxShadow: '0 0 20px #00ffff', color: '#000', fontWeight: 'bold'
            }}
          >
            {statusMsg ? "重試 (Retry)" : "✨ 啟動魔法 (Start Magic)"}
          </button>
          {statusMsg && <p style={{color: 'red', marginTop: '20px'}}>{statusMsg}</p>}
        </div>
      )}

      {/* 顯示載入狀態 */}
      {isStarted && statusMsg && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          color: '#00ffff', fontSize: '20px', zIndex: 9998
        }}>
          {statusMsg}
        </div>
      )}
    </>
  )
}