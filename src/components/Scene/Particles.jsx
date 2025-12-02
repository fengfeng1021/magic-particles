// src/components/Scene/Particles.jsx
import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// 優化版：愛心更集中，且是平面的
function getHeartPoints(count) {
  const points = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const t = Math.random() * Math.PI * 2
    // 使用更緊湊的數學公式
    const x = 12 * Math.pow(Math.sin(t), 3)
    const y = 10 * Math.cos(t) - 4 * Math.cos(2 * t) - 1.5 * Math.cos(3 * t) - Math.cos(4 * t)
    const z = 0 // ⚠️ 強制平面化，確保正面看清楚
    
    // 稍微加一點點噪點讓它不要太死板，但非常微小
    points[i * 3] = x * 0.15 + (Math.random()-0.5) * 0.2
    points[i * 3 + 1] = y * 0.15 + 2 + (Math.random()-0.5) * 0.2
    points[i * 3 + 2] = z
  }
  return points
}

// 優化版：文字密度更高，字體更粗
function getTextPoints(text, count) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  canvas.width = 250 // 加寬畫布
  canvas.height = 100
  ctx.font = '900 60px Arial' // 使用最粗字體 (900)
  ctx.fillStyle = 'white'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 125, 50)
  
  const imageData = ctx.getImageData(0, 0, 250, 100)
  const data = imageData.data
  const pixels = []
  
  // 採樣密度邏輯
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 200) { // 提高亮度門檻，只取最清楚的部分
      const index = i / 4
      const x = (index % 250) - 125
      const y = 50 - Math.floor(index / 250) 
      pixels.push({x, y})
    }
  }
  
  const points = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    if (pixels.length > 0) {
      // 隨機取樣確保粒子均勻分佈在筆畫上
      const pixel = pixels[Math.floor(Math.random() * pixels.length)]
      // 縮小比例，讓字看起來更精緻
      points[i * 3] = (pixel.x * 0.1) 
      points[i * 3 + 1] = (pixel.y * 0.1) 
      points[i * 3 + 2] = 0 // ⚠️ 強制平面化
    } else {
       points[i * 3] = 0; points[i * 3+1] = 0; points[i * 3+2] = 0;
    }
  }
  return points
}

export default function Particles({ handData }) {
  const { viewport } = useThree() 
  const pointsRef = useRef()
  const shockwaveRef = useRef(0)
  
  // 狀態管理
  const shapeTargetRef = useRef(null)
  const currentShapeNameRef = useRef("")
  
  // 防抖動變數
  const gestureHoldCounter = useRef(0) // 持續幀數
  const lastGestureRef = useRef(-1)    // 上一次偵測到的手勢

  const count = 5000 

  // 初始化粒子數據
  const { positions, originalPositions, velocities, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const originalPositions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    
    const color1 = new THREE.Color("#00ffff")

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const x = (Math.random() - 0.5) * 15
      const y = (Math.random() - 0.5) * 15
      const z = (Math.random() - 0.5) * 15
      
      positions.set([x, y, z], i3)
      originalPositions.set([x, y, z], i3)
      velocities.set([0, 0, 0], i3)
      colors.set([color1.r, color1.g, color1.b], i3)
    }
    return { positions, originalPositions, velocities, colors }
  }, [])

  useFrame((state, delta) => {
    if (!pointsRef.current) return

    const posAttr = pointsRef.current.geometry.attributes.position
    const colAttr = pointsRef.current.geometry.attributes.color

    // --- [1] 手勢識別與防抖 ---
    let maxGesture = -1
    if (handData.length > 0) {
      handData.forEach(h => {
        if (h.gesture > maxGesture) maxGesture = h.gesture
      })
    }

    if (maxGesture === lastGestureRef.current) {
      gestureHoldCounter.current++
    } else {
      gestureHoldCounter.current = 0
      lastGestureRef.current = maxGesture
    }

    // 觸發切換形狀
    if (gestureHoldCounter.current > 15) { // 加快一點反應速度 (15幀)
        if (maxGesture === 1 && currentShapeNameRef.current !== "1") {
            shapeTargetRef.current = getTextPoints("ONE", count)
            currentShapeNameRef.current = "1"
        } else if (maxGesture === 2 && currentShapeNameRef.current !== "HEART") {
            shapeTargetRef.current = getHeartPoints(count)
            currentShapeNameRef.current = "HEART"
        } else if (maxGesture === 3 && currentShapeNameRef.current !== "3") {
            shapeTargetRef.current = getTextPoints("COOL", count)
            currentShapeNameRef.current = "3"
        } else if (maxGesture === 0) {
            // 握拳重置
            if (shockwaveRef.current <= 0 && currentShapeNameRef.current !== "") {
                shockwaveRef.current = 1.0
                shapeTargetRef.current = null
                currentShapeNameRef.current = ""
            }
        } else if (maxGesture >= 5) {
            // 張開手重置
            shapeTargetRef.current = null
            currentShapeNameRef.current = ""
        }
    }

    // 爆炸衰減
    if (shockwaveRef.current > 0) {
      shockwaveRef.current -= delta * 2.0 
      if (shockwaveRef.current < 0) shockwaveRef.current = 0
    }

    // --- [2] 判斷是否為「雙手拉線」模式 ---
    // 條件：兩隻手都在畫面上，且兩隻手都在捏合 (Pinching)
    let isDualLineMode = false
    let lineStart = null
    let lineEnd = null
    
    if (handData.length === 2 && handData[0].isPinching && handData[1].isPinching) {
        isDualLineMode = true
        // 暫時打斷形狀模式
        shapeTargetRef.current = null 
        currentShapeNameRef.current = ""
        
        // 取得兩手座標
        lineStart = { 
            x: handData[0].x * viewport.width, 
            y: handData[0].y * viewport.height,
            z: 0 
        }
        lineEnd = { 
            x: handData[1].x * viewport.width, 
            y: handData[1].y * viewport.height,
            z: 0
        }
    }

    const calmColor = new THREE.Color("#00ffff") 
    const pinchColor = new THREE.Color("#ff0055") // 紅色 (捏合/愛心)
    const lineColor = new THREE.Color("#ffff00") // 黃色 (拉線)
    const whiteColor = new THREE.Color("#ffffff")
    const tempColor = new THREE.Color()

    const boundX = viewport.width / 2 + 1
    const boundY = viewport.height / 2 + 1
    const boundZ = 5 

    // ⚠️ 關鍵修正：如果有形狀，或者正在拉線，停止旋轉，確保正面朝向用戶
    if (shapeTargetRef.current || isDualLineMode) {
        // 慢慢轉回正面 (rotation y -> 0)
        pointsRef.current.rotation.y += (0 - pointsRef.current.rotation.y) * 0.1
    } else {
        // 自由模式下才自轉
        pointsRef.current.rotation.y += delta * 0.05
    }

    // --- 物理迴圈 ---
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const px = posAttr.array[i3]
      const py = posAttr.array[i3 + 1]
      const pz = posAttr.array[i3 + 2]

      let vx = velocities[i3]
      let vy = velocities[i3 + 1]
      let vz = velocities[i3 + 2]

      let isFormingShape = false
      
      // [A] 雙手拉線模式 (優先級最高)
      if (isDualLineMode) {
          // 線性插值 (Lerp)：根據粒子索引 i，把它們均勻排列在 start 和 end 之間
          // ratio = 0 ~ 1
          const ratio = i / count 
          
          // 計算目標點
          const tx = lineStart.x + (lineEnd.x - lineStart.x) * ratio
          const ty = lineStart.y + (lineEnd.y - lineStart.y) * ratio
          const tz = 0
          
          // 加入一點點隨機抖動，做成「能量流」的感覺
          const noise = 0.2
          const targetX = tx + (Math.random()-0.5) * noise
          const targetY = ty + (Math.random()-0.5) * noise
          
          // 強力吸附到線上
          vx += (targetX - px) * 8.0 * delta
          vy += (targetY - py) * 8.0 * delta
          vz += (tz - pz) * 8.0 * delta
          
          // 變黃色
          tempColor.set(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i))
          tempColor.lerp(lineColor, 0.2)

      } 
      // [B] 形狀模式
      else if (shapeTargetRef.current && shockwaveRef.current <= 0) {
        isFormingShape = true
        const tx = shapeTargetRef.current[i3]
        const ty = shapeTargetRef.current[i3 + 1]
        const tz = shapeTargetRef.current[i3 + 2]
        
        // ⚠️ 超強力鎖定：係數從 5.0 提升到 10.0，讓圖案非常穩
        vx += (tx - px) * 10.0 * delta
        vy += (ty - py) * 10.0 * delta
        vz += (tz - pz) * 10.0 * delta
        
        // 如果距離目標很近，就強制固定位置，防止抖動
        if (Math.abs(tx - px) < 0.1 && Math.abs(ty - py) < 0.1) {
            vx *= 0.5; vy *= 0.5; vz *= 0.5; // 剎車
        }

        tempColor.set(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i))
        tempColor.lerp(pinchColor, 0.1)
      }

      // [C] 自由手勢互動 (跟隨/捏合)
      let affectedByHand = false
      if (!isFormingShape && !isDualLineMode) {
        handData.forEach(hand => {
            const targetX = hand.x * viewport.width
            const targetY = hand.y * viewport.height
            const dx = targetX - px
            const dy = targetY - py
            const dz = 0 - pz
            const distSq = dx*dx + dy*dy + dz*dz
            const dist = Math.sqrt(distSq) + 0.1

            if (hand.isPinching) {
              // 單手捏合：黑洞 (強力)
              const force = 30.0 * delta
              vx += (dx / dist) * force
              vy += (dy / dist) * force
              vz += (dz / dist) * force
              affectedByHand = true
            } else {
              // ⚠️ 修正：跟隨模式 (讓粒子緊緊跟隨指尖)
              // 距離越近，引力越強，創造「磁鐵」感
              const force = 10.0 * delta // 提升跟隨力
              // 如果在一定範圍內
              if (dist < 3.0) {
                  vx += (dx / dist) * force
                  vy += (dy / dist) * force
                  vz += (dz / dist) * force
                  affectedByHand = true // 靠近手也變色
              }
              
              // 移除旋轉力，用戶說不喜歡亂轉
            }
        })
      }

      // [D] 特效與變色
      if (shockwaveRef.current > 0) {
        const distOrigin = Math.sqrt(px*px + py*py + pz*pz) + 0.1
        const boom = 40.0 * delta * shockwaveRef.current
        vx += (px / distOrigin) * boom
        vy += (py / distOrigin) * boom
        vz += (pz / distOrigin) * boom * 2
        
        tempColor.set(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i))
        tempColor.lerp(whiteColor, 0.2)
      } else if (!isFormingShape && !isDualLineMode) {
         if (affectedByHand) {
            // 被手吸引時變色
            tempColor.set(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i))
            tempColor.lerp(pinchColor, 0.2)
         } else {
            // 平靜時
            tempColor.set(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i))
            tempColor.lerp(calmColor, 0.05)
         }
      }

      // [E] 歸位力 (沒有互動時)
      if (handData.length === 0 && !shapeTargetRef.current && shockwaveRef.current <= 0) {
        const ox = originalPositions[i3]
        const oy = originalPositions[i3 + 1]
        const oz = originalPositions[i3 + 2]
        vx += (ox - px) * 1.5 * delta
        vy += (oy - py) * 1.5 * delta
        vz += (oz - pz) * 1.5 * delta
      }

      // [F] 邊界
      const bounceFactor = -0.5
      if (px > boundX) { vx *= bounceFactor; posAttr.array[i3] = boundX; }
      else if (px < -boundX) { vx *= bounceFactor; posAttr.array[i3] = -boundX; }
      if (py > boundY) { vy *= bounceFactor; posAttr.array[i3 + 1] = boundY; }
      else if (py < -boundY) { vy *= bounceFactor; posAttr.array[i3 + 1] = -boundY; }
      if (pz > boundZ) { vz *= bounceFactor; posAttr.array[i3 + 2] = boundZ; }
      else if (pz < -boundZ) { vz *= bounceFactor; posAttr.array[i3 + 2] = -boundZ; }

      // [G] 物理阻尼 (Friction)
      // ⚠️ 關鍵：大幅增加阻尼，消除「滑溜感」
      // 形狀/拉線模式下阻尼極高 (0.80)，讓粒子幾乎是瞬間停在目標點
      const friction = (isFormingShape || isDualLineMode) ? 0.80 : 0.88
      vx *= friction
      vy *= friction
      vz *= friction

      posAttr.array[i3] += vx
      posAttr.array[i3 + 1] += vy
      posAttr.array[i3 + 2] += vz

      velocities[i3] = vx
      velocities[i3 + 1] = vy
      velocities[i3 + 2] = vz

      colAttr.setXYZ(i, tempColor.r, tempColor.g, tempColor.b)
    }

    posAttr.needsUpdate = true
    colAttr.needsUpdate = true
    // 注意：這裡已經移除了 rotation.y += ... 的代碼，改由上方的邏輯控制
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={count} array={colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.12} // 稍微加大一點點，視覺更飽滿
        vertexColors={true}
        sizeAttenuation={true}
        transparent={true}
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}