const mappings: Array<[RegExp, string]> = [
  [/side plank|plank laterale/i, 'exercise-side-plank.jpg'],
  [/\bplank\b/i, 'exercise-plank.jpg'],
  [/crunch machine|ab crunch|abdominal machine|macchina addom|\bcrunch\b|addom/i, 'exercise-abs-machine.jpg'],
  [/lat machine|lat pulldown/i, 'exercise-lat.jpg'],
  [/rematore manubrio|one arm row/i, 'exercise-one-arm-row.jpg'],
  [/shoulder press/i, 'exercise-shoulder-press.jpg'],
  [/chest press incline|incline chest press/i, 'exercise-incline-press.jpg'],
  [/leg curl/i, 'exercise-leg-curl.jpg'],
  [/panca piana|bench press/i, 'exercise-bench-press.jpg'],
  [/croci cavi|cable crossover/i, 'exercise-cable-crossover.jpg'],
  [/split squat|affondo bulgar|bulgarian/i, 'exercise-split-squat.jpg'],
  [/^pulley$|pulley basso|seated cable row/i, 'exercise-seated-row.jpg'],
  [/alzate lat manubri|alzate laterali manubri/i, 'exercise-lateral-raise.jpg'],
  [/push down|pushdown/i, 'exercise-triceps-pushdown.jpg'],
  [/leg extension/i, 'exercise-leg-extension.jpg'],
  [/goblet squat|^goblet$/i, 'exercise-goblet-squat.jpg'],
  [/^chest press$|chest press machine/i, 'exercise-chest-press.jpg'],
  [/alzate lat cavo|alzate laterali cavo/i, 'exercise-cable-lateral.jpg'],
  [/curl manubri alternati|alternate dumbbell curl/i, 'exercise-alt-curl.jpg'],
  [/mobilit|rotazione spall|scapolar|allungamento|slanci/i, 'exercise-mobility.jpg']
]

export function imageForExercise(name: string, program: string, note: string): string {
  const all = `${name} ${program} ${note}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return `/${mappings.find(([pattern]) => pattern.test(all))?.[1] ?? 'icon.svg'}`
}
