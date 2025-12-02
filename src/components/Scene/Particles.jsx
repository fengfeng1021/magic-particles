// src/components/Scene/Particles.jsx
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function Particles({ handData }) {
  const pointsRef = useRef()
  const count = 5000 // 粒子數量

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

    // 獲取手部數據
    const hasHand = !!handData
    let targetX = 0, targetY = 0
    let isPinching = false
    
    if (hasHand) {
      // 映射座標範圍
      targetX = handData.x * 10
      targetY = handData.y * 6
      isPinching = handData.isPinching
    }

    // 定義顏色 (為了效能，我們在迴圈外定義)
    const calmColor = new THREE.Color("#00ffff") // 青色
    const pinchColor = new THREE.Color("#ff0055") // 緋紅色
    const tempColor = new THREE.Color()

    for (let i = 0; i < count; i++) {
      const i3 = i * 3

      // 1. 獲取當前位置
      const px = posAttr.array[i3]
      const py = posAttr.array[i3 + 1]
      const pz = posAttr.array[i3 + 2]

      // 2. 獲取速度
      let vx = velocities[i3]
      let vy = velocities[i3 + 1]
      let vz = velocities[i3 + 2]

      if (hasHand) {
        // --- 互動模式 ---
        
        // 計算到手的距離
        const dx = targetX - px
        const dy = targetY - py
        const dz = 0 - pz // 吸引到 Z=0 平面
        
        const distSq = dx*dx + dy*dy + dz*dz
        const dist = Math.sqrt(distSq) + 0.1 // 避免除以 0

        if (isPinching) {
          // [模式 A: 蓄力/黑洞]
          // 強力吸引，無視距離
          const force = 15.0 * delta 
          vx += (dx / dist) * force
          vy += (dy / dist) * force
          vz += (dz / dist) * force
          
          // 增加一點隨機抖動，感覺能量很不穩定
          vx += (Math.random() - 0.5) * 0.5
          vy += (Math.random() - 0.5) * 0.5
          vz += (Math.random() - 0.5) * 0.5

          // 變色：逐漸變紅
          tempColor.set(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i))
          tempColor.lerp(pinchColor, 0.1) // 快速變紅

        } else {
          // [模式 B: 跟隨/漩渦]
          // 讓粒子圍繞手指旋轉 (計算切線力)
          // 這會讓粒子形成像龍捲風一樣的效果
          const force = 2.0 * delta // 較弱的吸引力
          
          vx += (dx / dist) * force
          vy += (dy / dist) * force
          vz += (dz / dist) * force

          // 加入旋轉力 (Cross Product 概念的簡化版)
          vx += -dy * 0.5 * delta
          vy += dx * 0.5 * delta

          // 變色：慢慢變回青色
          tempColor.set(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i))
          tempColor.lerp(calmColor, 0.05)
        }

      } else {
        // --- 歸位模式 ---
        const ox = originalPositions[i3]
        const oy = originalPositions[i3 + 1]
        const oz = originalPositions[i3 + 2]

        // 彈簧力：拉回原點
        vx += (ox - px) * 0.5 * delta
        vy += (oy - py) * 0.5 * delta
        vz += (oz - pz) * 0.5 * delta
        
        // 變色：變回青色
        tempColor.set(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i))
        tempColor.lerp(calmColor, 0.02)
      }

      // 3. 物理模擬核心：摩擦力 (阻尼)
      // 必須有阻尼，否則粒子會無限加速
      const friction = isPinching ? 0.90 : 0.96 // 捏合時阻尼大一點，讓它快速聚攏
      vx *= friction
      vy *= friction
      vz *= friction

      // 4. 更新位置
      posAttr.array[i3] = px + vx
      posAttr.array[i3 + 1] = py + vy
      posAttr.array[i3 + 2] = pz + vz

      // 5. 更新速度緩存
      velocities[i3] = vx
      velocities[i3 + 1] = vy
      velocities[i3 + 2] = vz

      // 6. 更新顏色
      colAttr.setXYZ(i, tempColor.r, tempColor.g, tempColor.b)
    }

    // 告訴 Three.js 需要重繪
    posAttr.needsUpdate = true
    colAttr.needsUpdate = true
    
    // 整體微旋轉
    pointsRef.current.rotation.y += delta * 0.1
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