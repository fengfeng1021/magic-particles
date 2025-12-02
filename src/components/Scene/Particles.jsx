// src/components/Scene/Particles.jsx
import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// --- [優化 1] 圖案生成算法：降低採樣密度，提升效能 ---
function getHeartPoints(count) {
  const points = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const t = Math.random() * Math.PI * 2
    // 愛心公式
    const x = 12 * Math.pow(Math.sin(t), 3)
    const y = 10 * Math.cos(t) - 4 * Math.cos(2 * t) - 1.5 * Math.cos(3 * t) - Math.cos(4 * t)
    const z = 0 
    
    // 減少隨機噪點，讓形狀更銳利
    points[i * 3] = x * 0.15 
    points[i * 3 + 1] = y * 0.15 + 2 
    points[i * 3 + 2] = z 
  }
  return points
}

function getTextPoints(text, count) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  // 1. 判斷是否為特定的長文字 (告白專用)
  const isLongText = text.includes("章文馨")
  
  // 2. 設定行數與內容
  // 如果是長文字，拆成兩行；否則維持單行
  const lines = isLongText ? ["愛你哦", "章文馨寶寶 ❤"] : [text]
  
  // 3. 調整字體大小與畫布
  // 長文字用小一點的字 (60)，單行字用大字 (80)
  const fontSize = isLongText ? 60 : 80 
  
  // 計算最長的一行寬度
  const longestLine = lines.reduce((a, b) => a.length > b.length ? a : b)
  const estimatedWidth = longestLine.length * fontSize + 50
  // 如果是兩行，畫布高度要加倍
  const estimatedHeight = isLongText ? fontSize * 4 : 150 

  canvas.width = estimatedWidth
  canvas.height = estimatedHeight

  ctx.font = `900 ${fontSize}px "Microsoft YaHei", sans-serif`
  ctx.fillStyle = 'white'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // 4. 繪製文字 (支援多行)
  if (lines.length > 1) {
      // 雙行模式：上下排列
      // 第一行畫在上面 (30% 高度處)
      ctx.fillText(lines[0], estimatedWidth / 2, estimatedHeight * 0.3)
      // 第二行畫在下面 (70% 高度處)
      ctx.fillText(lines[1], estimatedWidth / 2, estimatedHeight * 0.7)
  } else {
      // 單行模式：置中
      ctx.fillText(text, estimatedWidth / 2, estimatedHeight / 2)
  }
  
  const imageData = ctx.getImageData(0, 0, estimatedWidth, estimatedHeight)
  const data = imageData.data
  const pixels = []
  
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 200) { 
      const index = i / 4
      const x = (index % estimatedWidth) - (estimatedWidth / 2)
      // Y 軸計算：將 Canvas 的 Y 座標轉換為 3D 空間的中心
      const y = (estimatedHeight / 2) - Math.floor(index / estimatedWidth) 
      pixels.push({x, y})
    }
  }
  
  const points = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    if (pixels.length > 0) {
      const pixel = pixels[Math.floor(Math.random() * pixels.length)]
      
      // 5. 縮放係數 (Scale)
      // 如果是長文字，縮小為 0.025 (讓它能在 iPad 上完整顯示)
      // 如果是單行短字，維持 0.04 (大氣魄)
      const scale = isLongText ? 0.025 : 0.04
      
      points[i * 3] = pixel.x * scale
      points[i * 3 + 1] = pixel.y * scale
      points[i * 3 + 2] = 0 
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
  
  const shapeTargetRef = useRef(null)
  const currentShapeNameRef = useRef("")
  
  const gestureHoldCounter = useRef(0)
  const lastGestureRef = useRef(-1)

  // --- [優化 2] 粒子數量減半：解決卡頓 ---
  // 3000 顆足夠表現文字，且對 iPad/手機非常友善
  const count = 3000 

  const { positions, originalPositions, velocities, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const originalPositions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    
    const color1 = new THREE.Color("#00ffff")

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      // 初始分佈範圍縮小一點，避免太散
      const x = (Math.random() - 0.5) * 12
      const y = (Math.random() - 0.5) * 8
      const z = (Math.random() - 0.5) * 5
      
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

    // 1. 手勢識別邏輯
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

    // 手勢觸發 (維持 0.3 秒)
    if (gestureHoldCounter.current > 15) {
        if (maxGesture === 1 && currentShapeNameRef.current !== "1") {
            shapeTargetRef.current = getTextPoints("ONE", count)
            currentShapeNameRef.current = "1"
        } else if (maxGesture === 2 && currentShapeNameRef.current !== "HEART") {
            shapeTargetRef.current = getHeartPoints(count)
            currentShapeNameRef.current = "HEART"
        } else if (maxGesture === 3 && currentShapeNameRef.current !== "3") {
            shapeTargetRef.current = getTextPoints("COOL", count)
            currentShapeNameRef.current = "3"
        } else if (maxGesture === 4 && currentShapeNameRef.current !== "LOVE") {
            shapeTargetRef.current = getTextPoints("愛你哦 章文馨寶寶 ❤", count)
            currentShapeNameRef.current = "LOVE"
        } else if (maxGesture === 0) {
            // 握拳：爆炸
            if (shockwaveRef.current <= 0 && currentShapeNameRef.current !== "") {
                shockwaveRef.current = 1.0
                shapeTargetRef.current = null
                currentShapeNameRef.current = ""
            }
        } else if (maxGesture >= 5) {
            // 張開：自由模式
            shapeTargetRef.current = null
            currentShapeNameRef.current = ""
        }
    }

    // 爆炸邏輯
    if (shockwaveRef.current > 0) {
      shockwaveRef.current -= delta * 2.0 
      if (shockwaveRef.current < 0) shockwaveRef.current = 0
    }

    // 拉線模式判斷
    let isDualLineMode = false
    let lineStart = null, lineEnd = null
    if (handData.length === 2 && handData[0].isPinching && handData[1].isPinching) {
        isDualLineMode = true
        shapeTargetRef.current = null 
        currentShapeNameRef.current = ""
        lineStart = { x: handData[0].x * viewport.width, y: handData[0].y * viewport.height }
        lineEnd = { x: handData[1].x * viewport.width, y: handData[1].y * viewport.height }
    }

    // 🚫 移除所有旋轉邏輯，強制鎖定正面視角
    // 這樣不管你做什麼操作，畫布永遠是正對著你的
    pointsRef.current.rotation.set(0, 0, 0)

    const calmColor = new THREE.Color("#00ffff") 
    const pinchColor = new THREE.Color("#ff0055") 
    const lineColor = new THREE.Color("#ffff00") 
    const whiteColor = new THREE.Color("#ffffff")
    const tempColor = new THREE.Color()

    const boundX = viewport.width / 2 + 1
    const boundY = viewport.height / 2 + 1
    const boundZ = 5 

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      let px = posAttr.array[i3]
      let py = posAttr.array[i3 + 1]
      let pz = posAttr.array[i3 + 2]

      let vx = velocities[i3]
      let vy = velocities[i3 + 1]
      let vz = velocities[i3 + 2]

      // --- [優化 3] 物理引擎核心：防抖動與強力吸附 ---
      
      // 狀態 A: 拉線模式
      if (isDualLineMode) {
          const ratio = i / count 
          const tx = lineStart.x + (lineEnd.x - lineStart.x) * ratio
          const ty = lineStart.y + (lineEnd.y - lineStart.y) * ratio
          const tz = 0
          
          // 強力 Lerp，減少抖動
          vx += (tx - px) * 10.0 * delta
          vy += (ty - py) * 10.0 * delta
          vz += (tz - pz) * 10.0 * delta
          
          tempColor.set(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i))
          tempColor.lerp(lineColor, 0.2)
      } 
      // 狀態 B: 形狀模式 (文字/愛心)
      else if (shapeTargetRef.current && shockwaveRef.current <= 0) {
        const tx = shapeTargetRef.current[i3]
        const ty = shapeTargetRef.current[i3 + 1]
        const tz = shapeTargetRef.current[i3 + 2]
        
        const dx = tx - px
        const dy = ty - py
        const dz = tz - pz
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz)

        // ⚠️ 關鍵防抖：如果非常靠近目標 (< 0.05)，直接鎖死位置，停止物理運算
        if (dist < 0.05) {
            vx = 0
            vy = 0
            vz = 0
            px = tx
            py = ty
            pz = tz
        } else {
            // 否則使用強力彈簧飛向目標
            vx += dx * 8.0 * delta
            vy += dy * 8.0 * delta
            vz += dz * 8.0 * delta
        }

        tempColor.set(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i))
        tempColor.lerp(pinchColor, 0.1)
      }
      // 狀態 C: 自由互動模式
      else {
        let affectedByHand = false
        handData.forEach(hand => {
            const targetX = hand.x * viewport.width
            const targetY = hand.y * viewport.height
            const dx = targetX - px
            const dy = targetY - py
            const dz = 0 - pz
            const distSq = dx*dx + dy*dy + dz*dz
            const dist = Math.sqrt(distSq) + 0.1

            if (hand.isPinching) {
              // 捏合：強力黑洞
              const force = 30.0 * delta
              vx += (dx / dist) * force
              vy += (dy / dist) * force
              vz += (dz / dist) * force
              affectedByHand = true
            } else {
              // ⚠️ 修正跟隨：只有當距離小於 3 時才受到吸引，避免全螢幕粒子亂跑
              if (dist < 3.5) {
                  const force = 15.0 * delta // 增強吸引力
                  vx += (dx / dist) * force
                  vy += (dy / dist) * force
                  vz += (dz / dist) * force
                  affectedByHand = true
              }
            }
        })
        
        // 特效
        if (shockwaveRef.current > 0) {
            const distOrigin = Math.sqrt(px*px + py*py + pz*pz) + 0.1
            const boom = 40.0 * delta * shockwaveRef.current
            vx += (px / distOrigin) * boom
            vy += (py / distOrigin) * boom
            vz += (pz / distOrigin) * boom * 2
            tempColor.set(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i))
            tempColor.lerp(whiteColor, 0.2)
        } else if (affectedByHand) {
            tempColor.set(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i))
            tempColor.lerp(pinchColor, 0.2)
        } else {
            tempColor.set(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i))
            tempColor.lerp(calmColor, 0.05)
        }

        // 歸位
        if (handData.length === 0 && shockwaveRef.current <= 0) {
            const ox = originalPositions[i3]
            const oy = originalPositions[i3 + 1]
            const oz = originalPositions[i3 + 2]
            vx += (ox - px) * 2.0 * delta // 加快歸位速度
            vy += (oy - py) * 2.0 * delta
            vz += (oz - pz) * 2.0 * delta
        }
      }

      // 邊界
      const bounceFactor = -0.4
      if (px > boundX) { vx *= bounceFactor; px = boundX; }
      else if (px < -boundX) { vx *= bounceFactor; px = -boundX; }
      if (py > boundY) { vy *= bounceFactor; py = boundY; }
      else if (py < -boundY) { vy *= bounceFactor; py = -boundY; }
      if (pz > boundZ) { vz *= bounceFactor; pz = boundZ; }
      else if (pz < -boundZ) { vz *= bounceFactor; pz = -boundZ; }

      // --- [優化 4] 阻尼設定：消除滑溜感 ---
      // 形狀模式下阻尼極高 (0.85)，讓它迅速定格
      // 自由模式下 (0.90)，有液體感但不會亂飛
      const friction = (shapeTargetRef.current || isDualLineMode) ? 0.85 : 0.90
      
      vx *= friction
      vy *= friction
      vz *= friction

      // 更新位置
      posAttr.array[i3] = px + vx
      posAttr.array[i3 + 1] = py + vy
      posAttr.array[i3 + 2] = pz + vz

      velocities[i3] = vx
      velocities[i3 + 1] = vy
      velocities[i3 + 2] = vz

      colAttr.setXYZ(i, tempColor.r, tempColor.g, tempColor.b)
    }

    posAttr.needsUpdate = true
    colAttr.needsUpdate = true
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={count} array={colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.15} // 粒子稍微變大，彌補數量減少
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