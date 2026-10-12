export function BackButton({onBack}: {onBack:()=>void}) {
  return <button type="button" className="navigation-back" onClick={onBack}>← Indietro</button>
}
