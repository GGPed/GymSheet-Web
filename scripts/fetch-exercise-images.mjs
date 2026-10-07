import { mkdir, writeFile, access } from 'node:fs/promises'

const base = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'
const out = new URL('../public/exercises/', import.meta.url)
await mkdir(out, { recursive: true })

const images = {
  'exercise-lat.jpg': 'Wide-Grip_Lat_Pulldown/0.jpg',
  'exercise-one-arm-row.jpg': 'One-Arm_Dumbbell_Row/0.jpg',
  'exercise-shoulder-press.jpg': 'Machine_Shoulder_Military_Press/0.jpg',
  'exercise-incline-press.jpg': 'Leverage_Incline_Chest_Press/0.jpg',
  'exercise-leg-curl.jpg': 'Lying_Leg_Curls/0.jpg',
  'exercise-bench-press.jpg': 'Barbell_Bench_Press_-_Medium_Grip/0.jpg',
  'exercise-cable-crossover.jpg': 'Cable_Crossover/0.jpg',
  'exercise-split-squat.jpg': 'Split_Squat_with_Dumbbells/0.jpg',
  'exercise-seated-row.jpg': 'Seated_Cable_Rows/0.jpg',
  'exercise-lateral-raise.jpg': 'Side_Lateral_Raise/0.jpg',
  'exercise-triceps-pushdown.jpg': 'Triceps_Pushdown_-_Rope_Attachment/0.jpg',
  'exercise-leg-extension.jpg': 'Leg_Extensions/0.jpg',
  'exercise-goblet-squat.jpg': 'Goblet_Squat/0.jpg',
  'exercise-chest-press.jpg': 'Leverage_Chest_Press/0.jpg',
  'exercise-cable-lateral.jpg': 'Standing_Low-Pulley_Deltoid_Raise/0.jpg',
  'exercise-alt-curl.jpg': 'Dumbbell_Alternate_Bicep_Curl/0.jpg',
  'exercise-plank.jpg': 'Plank/0.jpg',
  'exercise-side-plank.jpg': 'Push_Up_to_Side_Plank/0.jpg',
  'exercise-abs-machine.jpg': 'Ab_Crunch_Machine/0.jpg',
  'exercise-mobility.jpg': 'Shoulder_Stretch/0.jpg',
  'exercise-mobility-rotation.jpg': 'Arm_Circles/0.jpg',
  'exercise-mobility-scapular.jpg': 'Scapular_Pull-Up/0.jpg',
  'exercise-mobility-swing.jpg': 'Front_Leg_Raises/0.jpg',
  'exercise-mobility-stretch.jpg': 'Cat_Stretch/0.jpg'
}

for (const [name, source] of Object.entries(images)) {
  const target = new URL(name, out)
  try { await access(target); continue } catch {}
  const response = await fetch(`${base}/${source}`)
  if (!response.ok) throw new Error(`Download ${source}: ${response.status}`)
  await writeFile(target, Buffer.from(await response.arrayBuffer()))
  console.log(`Downloaded ${name}`)
}
