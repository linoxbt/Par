"use client"

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 40 }}>
        <h1>Par hit an unexpected error.</h1>
        <p>Nothing was sent onchain.</p>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  )
}
