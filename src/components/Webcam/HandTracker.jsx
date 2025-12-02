// src/components/Webcam/HandTracker.jsx
import { useEffect, useRef } from 'react'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

export default function HandTracker({ onHandUpdate }) {
  const videoRef = useRef(null)
  const handLandmarkerRef = useRef(null)
  const animationFrameId = useRef(null)

  useEffect(() => {
    const setup = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
  import.meta.env.BASE_URL + 'models/vision_wasm_internal.wasm'
)
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        })
        
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 },
          audio: false,
        })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadeddata = () => {
            videoRef.current.play() 
    predictWebcam()
  }
        }
      } catch (error) {
        console.error(error)
      }
    }
    setup()
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current)
      if (handLandmarkerRef.current) handLandmarkerRef.current.close()
    }
  }, [onHandUpdate])

  const predictWebcam = () => {
    if (handLandmarkerRef.current && videoRef.current && videoRef.current.readyState === 4) {
      const results = handLandmarkerRef.current.detectForVideo(videoRef.current, Date.now())

      if (results.landmarks && results.landmarks.length > 0) {
        const hand = results.landmarks[0]
        
        // 1. 獲取關鍵點
        const indexTip = hand[8]  // 食指指尖
        const thumbTip = hand[4]  // 大拇指指尖

        // 2. 計算 3D 空間座標 (映射到 Three.js 範圍)
        const x = (indexTip.x - 0.5) * 2
        const y = -(indexTip.y - 0.5) * 2

        // 3. 計算捏合距離 (食指與拇指的直線距離)
        const distance = Math.sqrt(
          Math.pow(indexTip.x - thumbTip.x, 2) + 
          Math.pow(indexTip.y - thumbTip.y, 2)
        )

        // 4. 判斷是否捏合 (門檻值設為 0.1)
        const isPinching = distance < 0.1

        // 回傳包含狀態的物件
        onHandUpdate({ x, y, isPinching })
      } else {
        onHandUpdate(null)
      }
    }
    animationFrameId.current = requestAnimationFrame(predictWebcam)
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      style={{ width: '0px', height: '0px', opacity: 0 }}
    />
  )
}