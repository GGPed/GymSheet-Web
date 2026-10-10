export const DOWNLOAD_READY='gymsheet-download-ready'
export interface GeneratedDownload {url:string;filename:string;expiresAt:number}
export function downloadBlob(blob:Blob,filename:string):void {
  const url=URL.createObjectURL(blob),link=document.createElement('a')
  link.href=url;link.download=filename;link.style&&(link.style.display='none')
  try{document.body?.appendChild(link);if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent<GeneratedDownload>(DOWNLOAD_READY,{detail:{url,filename,expiresAt:Date.now()+300000}}));link.click()}catch(error){URL.revokeObjectURL(url);throw error}finally{link.remove?.()}
  // Mobile browsers may need time to take ownership of the generated file.
  setTimeout(()=>URL.revokeObjectURL(url),300000)
}
