'use client'

export default function ShareCodeButtons({ code, gameName }: { code: string; gameName: string }) {
  const text = `Join my ${gameName} room on Zuno! Room code: ${code}`

  const handleMessage = () => {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    window.location.href = `sms:${isIOS ? '&' : '?'}body=${encodeURIComponent(text)}`
  }

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div className="flex gap-2 mt-3">
      <button
        onClick={handleMessage}
        className="flex items-center gap-1.5 text-xs font-bold bg-white border-2 border-[var(--border)] rounded-lg px-3 py-2 hover:border-[var(--accent)] transition-colors"
      >
        💬 Message
      </button>
      <button
        onClick={handleWhatsApp}
        className="flex items-center gap-1.5 text-xs font-bold bg-white border-2 border-[var(--border)] rounded-lg px-3 py-2 hover:border-[#25D366] transition-colors"
      >
        <span className="text-[#25D366]">●</span> WhatsApp
      </button>
    </div>
  )
}
