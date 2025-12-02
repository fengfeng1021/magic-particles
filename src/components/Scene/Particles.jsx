// src/components/Scene/Particles.jsx
import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// --- 形狀生成函數 ---
function getHeartPoints(count) {
  const points = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const t = Math.random() * Math.PI * 2
    const x = 16 * Math.pow(Math.sin(t), 3)
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    const z = (Math.random() - 0.5) * 5
    points[i * 3] = x * 0.2
    points[i * 3 + 1] = y * 0.2 + 2
    points[i * 3 + 2] = z
  }
  return points
}

function getTextPoints(text, count) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  canvas.width = 200
  canvas.height = 100
  ctx.font = 'bold 50px Arial'
  ctx.fillStyle = 'white'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 100, 50)
  
  const imageData = ctx.getImageData(0, 0, 200, 100)
  const data = imageData.data
  const pixels = []
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 128) {
      const index = i / 4
      const x = (index % 200) - 100
      const y = 50 - Math.floor(index / 200) 
      pixels.push({x, y})
    }
  }
  const points = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    if (pixels.length > 0) {
      const pixel = pixels[i % pixels.length]
      points[i * 3] = (pixel.x * 0.15) + (Math.random()-0.5)*0.5
      points[i * 3 + 1] = (pixel.y * 0.15) + (Math.random()-0.5)*0.5
      points[i * 3 + 2] = (Math.random() - 0.5) * 2
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

    // --- [1] 手勢識別與防抖邏輯 ---
    let maxGesture = -1
    if (handData.length > 0) {
      handData.forEach(h => {
        if (h.gesture > maxGesture) maxGesture = h.gesture
      })
    }

    // 只有當手勢改變，且該手勢持續超過 20 幀 (約0.3秒) 才執行
    if (maxGesture === lastGestureRef.current) {
      gestureHoldCounter.current++
    } else {
      gestureHoldCounter.current = 0
      lastGestureRef.current = maxGesture
    }

    // 當穩定偵測到手勢後，執行切換
    if (gestureHoldCounter.current > 20) {
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
            // 握拳 (0): 觸發爆炸/重置
            if (shockwaveRef.current <= 0 && currentShapeNameRef.current !== "") {
                shockwaveRef.current = 1.0
                shapeTargetRef.current = null
                currentShapeNameRef.current = ""
            }
        } else if (maxGesture >= 5) {
            // 張開手 (5): 自由模式
            if (currentShapeNameRef.current !== "") {
                shapeTargetRef.current = null
                currentShapeNameRef.current = ""
            }
        }
    }

    // 爆炸能量衰減
    if (shockwaveRef.current > 0) {
      shockwaveRef.current -= delta * 2.0 
      if (shockwaveRef.current < 0) shockwaveRef.current = 0
    }

    const calmColor = new THREE.Color("#00ffff") 
    const pinchColor = new THREE.Color("#ff0055") 
    const whiteColor = new THREE.Color("#ffffff")
    const tempColor = new THREE.Color()

    const boundX = viewport.width / 2 + 1
    const boundY = viewport.height / 2 + 1
    const boundZ = 5 

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
      
      // [A] 形狀優先模式
      if (shapeTargetRef.current && shockwaveRef.current <= 0) {
        isFormingShape = true
        const tx = shapeTargetRef.current[i3]
        const ty = shapeTargetRef.current[i3 + 1]
        const tz = shapeTargetRef.current[i3 + 2]
        
        // 使用強力彈簧吸附，減少混亂感
        vx += (tx - px) * 5.0 * delta
        vy += (ty - py) * 5.0 * delta
        vz += (tz - pz) * 5.0 * delta
        
        tempColor.set(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i))
        tempColor.lerp(pinchColor, 0.05)
      }

      // [B] 手勢互動 (僅在非形狀模式下生效)
      let affectedByHand = false
      if (!isFormingShape) {
        handData.forEach(hand => {
            const targetX = hand.x * viewport.width
            const targetY = hand.y * viewport.height
            const dx = targetX - px
            const dy = targetY - py
            const dz = 0 - pz
            const distSq = dx*dx + dy*dy + dz*dz
            const dist = Math.sqrt(distSq) + 0.1

            // 調整：降低旋轉亂流，增加指向性跟隨
            if (hand.isPinching) {
              const force = 20.0 * delta
              vx += (dx / dist) * force
              vy += (dy / dist) * force
              vz += (dz / dist) * force
              affectedByHand = true
            } else {
              // 跟隨力
              const force = 6.0 * delta
              vx += (dx / dist) * force
              vy += (dy / dist) * force
              vz += (dz / dist) * force
              
              // 旋轉力 (大幅減弱，減少混亂感)
              const spin = 1.0 * delta 
              vx += -dy * spin / dist 
              vy += dx * spin / dist
            }
        })
      }

      // [C] 特效與變色
      if (shockwaveRef.current > 0) {
        const distOrigin = Math.sqrt(px*px + py*py + pz*pz) + 0.1
        const boom = 40.0 * delta * shockwaveRef.current
        vx += (px / distOrigin) * boom
        vy += (py / distOrigin) * boom
        vz += (pz / distOrigin) * boom * 2
        
        tempColor.set(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i))
        tempColor.lerp(whiteColor, 0.2)
      } else if (!isFormingShape) {
         if (affectedByHand) {
            tempColor.set(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i))
            tempColor.lerp(pinchColor, 0.1)
         } else {
            tempColor.set(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i))
            tempColor.lerp(calmColor, 0.05)
         }
      }

      // [D] 歸位力
      if (handData.length === 0 && !shapeTargetRef.current && shockwaveRef.current <= 0) {
        const ox = originalPositions[i3]
        const oy = originalPositions[i3 + 1]
        const oz = originalPositions[i3 + 2]
        vx += (ox - px) * 1.5 * delta
        vy += (oy - py) * 1.5 * delta
        vz += (oz - pz) * 1.5 * delta
      }

      // [E] 邊界檢查
      const bounceFactor = -0.5
      if (px > boundX) { vx *= bounceFactor; posAttr.array[i3] = boundX; }
      else if (px < -boundX) { vx *= bounceFactor; posAttr.array[i3] = -boundX; }
      if (py > boundY) { vy *= bounceFactor; posAttr.array[i3 + 1] = boundY; }
      else if (py < -boundY) { vy *= bounceFactor; posAttr.array[i3 + 1] = -boundY; }
      if (pz > boundZ) { vz *= bounceFactor; posAttr.array[i3 + 2] = boundZ; }
      else if (pz < -boundZ) { vz *= bounceFactor; posAttr.array[i3 + 2] = -boundZ; }

      // [F] 物理核心調整：大幅增加阻尼 (Friction)
      // 0.85 的阻尼會讓粒子運動更有「液體感」，不會亂飛
      const friction = isFormingShape ? 0.85 : 0.90
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
    pointsRef.current.rotation.y += delta * 0.05
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