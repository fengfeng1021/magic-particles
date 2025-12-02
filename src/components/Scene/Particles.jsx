// src/components/Scene/Particles.jsx
import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber' // 引入 useThree 用於獲取螢幕寬度
import * as THREE from 'three'

// 生成愛心形狀的座標點
function getHeartPoints(count) {
  const points = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const t = Math.random() * Math.PI * 2
    // 愛心數學公式
    const x = 16 * Math.pow(Math.sin(t), 3)
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    const z = (Math.random() - 0.5) * 5 // 增加一點厚度
    
    // 縮小一點並存入
    points[i * 3] = x * 0.2
    points[i * 3 + 1] = y * 0.2 + 2 // 往上提一點
    points[i * 3 + 2] = z
  }
  return points
}

// 利用 Canvas 將文字轉換成粒子點
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
  const points = new Float32Array(count * 3)
  const pixels = []
  
  // 找出所有有顏色的像素點
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 128) { // 如果夠亮
      const index = i / 4
      const x = (index % 200) - 100
      const y = 50 - Math.floor(index / 200) 
      pixels.push({x, y})
    }
  }
  
  // 將粒子隨機分配到這些像素點上
  for (let i = 0; i < count; i++) {
    if (pixels.length > 0) {
      const pixel = pixels[i % pixels.length] // 循環使用
      // 隨機抖動一下，避免排列太整齊
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
  const prevPinchRef = useRef(false)
  const shockwaveRef = useRef(0)
  
  // 新增：目標形狀的座標陣列 (如果為 null 代表自由模式)
  const shapeTargetRef = useRef(null)
  // 新增：當前顯示的文字/形狀名稱
  const currentShapeNameRef = useRef("")

  const count = 5000

  // 初始化數據：位置、原始位置、速度、顏色
  const { positions, originalPositions, velocities, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const originalPositions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3) // 速度向量 (vx, vy, vz)
    const colors = new Float32Array(count * 3)
    
    const color1 = new THREE.Color("#00ffff") // 青色 (平靜)

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      // 擴大分佈範圍，更有氣勢
      const x = (Math.random() - 0.5) * 15
      const y = (Math.random() - 0.5) * 15
      const z = (Math.random() - 0.5) * 15
      
      positions.set([x, y, z], i3)
      originalPositions.set([x, y, z], i3)
      velocities.set([0, 0, 0], i3) // 初始靜止
      
      colors.set([color1.r, color1.g, color1.b], i3)
    }
    
    return { positions, originalPositions, velocities, colors }
  }, [])

  useFrame((state, delta) => {
    if (!pointsRef.current) return

    const posAttr = pointsRef.current.geometry.attributes.position
    const colAttr = pointsRef.current.geometry.attributes.color

    // --- [1] 手勢識別區 ---
    // 檢查是否有特定的手勢來觸發形狀
    // 邏輯：取所有手勢中最大的數字 (例如兩隻手分別比 1 和 5，就觸發 5)
    let maxGesture = 0
    let anyHandPinching = false
    
    if (handData.length > 0) {
      handData.forEach(h => {
        if (h.gesture > maxGesture) maxGesture = h.gesture
        if (h.isPinching) anyHandPinching = true
      })
    }

    // 根據手勢切換形狀 (這裡定義你的文字內容)
    if (maxGesture === 1) {
       if (currentShapeNameRef.current !== "1") {
         shapeTargetRef.current = getTextPoints("ONE", count)
         currentShapeNameRef.current = "1"
       }
    } else if (maxGesture === 2) {
       // 比 2 (YA) 的時候顯示愛心
       if (currentShapeNameRef.current !== "HEART") {
         shapeTargetRef.current = getHeartPoints(count)
         currentShapeNameRef.current = "HEART"
       }
    } else if (maxGesture === 3) {
       if (currentShapeNameRef.current !== "3") {
         shapeTargetRef.current = getTextPoints("COOL", count)
         currentShapeNameRef.current = "3"
       }
    } else if (maxGesture === 5) {
       // 比 5 (張開手) 清除形狀，回到自由模式
       shapeTargetRef.current = null
       currentShapeNameRef.current = ""
    }

    // 處理爆炸邏輯
    if (prevPinchRef.current && !anyHandPinching) {
      shockwaveRef.current = 1.0 
    }
    prevPinchRef.current = anyHandPinching

    if (shockwaveRef.current > 0) {
      shockwaveRef.current -= delta * 2.0 
      if (shockwaveRef.current < 0) shockwaveRef.current = 0
    }

    const calmColor = new THREE.Color("#00ffff") 
    const pinchColor = new THREE.Color("#ff0055") 
    const whiteColor = new THREE.Color("#ffffff")
    const tempColor = new THREE.Color()

    // 2. 定義邊界 (根據當前視窗大小)
    // viewport.width 是 Three.js 場景的可視寬度，這確保了精準對應
    const boundX = viewport.width / 2 + 1 // 左右邊界
    const boundY = viewport.height / 2 + 1 // 上下邊界
    const boundZ = 5 // 前後邊界

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const px = posAttr.array[i3]
      const py = posAttr.array[i3 + 1]
      const pz = posAttr.array[i3 + 2]

      let vx = velocities[i3]
      let vy = velocities[i3 + 1]
      let vz = velocities[i3 + 2]

      // --- [A] 形狀優先模式 ---
      // 如果當前有目標形狀 (比如文字或愛心)，粒子會優先飛過去
      let isFormingShape = false
      
      if (shapeTargetRef.current && shockwaveRef.current <= 0) {
        isFormingShape = true
        // 獲取該粒子在形狀中的目標位置
        const tx = shapeTargetRef.current[i3]
        const ty = shapeTargetRef.current[i3 + 1]
        const tz = shapeTargetRef.current[i3 + 2]
        
        // 強力飛向目標 (Lerp 效果)
        // 增加彈簧感：速度 += (目標 - 當前) * 強度
        vx += (tx - px) * 3.0 * delta
        vy += (ty - py) * 3.0 * delta
        vz += (tz - pz) * 3.0 * delta
        
        // 形成形狀時變成粉色
        tempColor.set(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i))
        tempColor.lerp(pinchColor, 0.05)
      }

      // --- [B] 手勢互動 (僅在非形狀模式下生效) ---
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

            if (hand.isPinching) {
              const force = 20.0 * delta
              vx += (dx / dist) * force
              vy += (dy / dist) * force
              vz += (dz / dist) * force
              affectedByHand = true
            } else {
              const force = 5.0 * delta
              vx += (dx / dist) * force
              vy += (dy / dist) * force
              vz += (dz / dist) * force
              
              const spin = 5.0 * delta
              vx += -dy * spin / dist 
              vy += dx * spin / dist
            }
        })
      }

      // --- [C] 全域特效與變色 ---
      if (shockwaveRef.current > 0) {
        const distOrigin = Math.sqrt(px*px + py*py + pz*pz) + 0.1
        const boom = 50.0 * delta * shockwaveRef.current
        vx += (px / distOrigin) * boom
        vy += (py / distOrigin) * boom
        vz += (pz / distOrigin) * boom * 2
        
        tempColor.set(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i))
        tempColor.lerp(whiteColor, 0.2)
        // 爆炸會打斷形狀
        shapeTargetRef.current = null 
        currentShapeNameRef.current = ""

      } else if (!isFormingShape) {
         if (affectedByHand) {
            tempColor.set(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i))
            tempColor.lerp(pinchColor, 0.1)
         } else {
            tempColor.set(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i))
            tempColor.lerp(calmColor, 0.05)
         }
      }

      // --- [D] 歸位力 (沒有形狀 也 沒有手的時候) ---
      if (handData.length === 0 && !shapeTargetRef.current && shockwaveRef.current <= 0) {
        const ox = originalPositions[i3]
        const oy = originalPositions[i3 + 1]
        const oz = originalPositions[i3 + 2]
        vx += (ox - px) * 1.0 * delta
        vy += (oy - py) * 1.0 * delta
        vz += (oz - pz) * 1.0 * delta
      }

      // --- [D] 邊界檢查 (Wall Bounce) ---
      // 這是防止粒子散開到外面的關鍵
      const bounceFactor = -0.6 // 反彈係數 (負數代表反向，0.6 代表損失一點能量)
      
      if (px > boundX) { vx *= bounceFactor; posAttr.array[i3] = boundX; }
      else if (px < -boundX) { vx *= bounceFactor; posAttr.array[i3] = -boundX; }

      if (py > boundY) { vy *= bounceFactor; posAttr.array[i3 + 1] = boundY; }
      else if (py < -boundY) { vy *= bounceFactor; posAttr.array[i3 + 1] = -boundY; }
      
      if (pz > boundZ) { vz *= bounceFactor; posAttr.array[i3 + 2] = boundZ; }
      else if (pz < -boundZ) { vz *= bounceFactor; posAttr.array[i3 + 2] = -boundZ; }

      // --- [E] 更新位置與速度 ---
      // 阻尼 (空氣阻力)
      const friction = 0.95
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
        size={0.1}
        vertexColors={true} // 啟用頂點顏色，這樣才能變色
        sizeAttenuation={true}
        transparent={true}
        opacity={0.8}
        blending={THREE.AdditiveBlending} // 發光疊加模式
        depthWrite={false} // 關閉深度寫入，讓粒子重疊時更亮
      />
    </points>
  )
}