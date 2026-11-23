"use client";

/** Последний рубеж: ошибка в корневом layout. Стили приложения здесь недоступны, поэтому всё инлайн. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
          color: "#f1f4f0",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div>
          
          <h1 style={{ fontSize: 22 }}>Match&amp;Play временно недоступен</h1>
          <p style={{ color: "#8f9791" }}>Попробуйте обновить страницу через минуту.</p>
          <button
            onClick={reset}
            style={{
              marginTop: 12,
              height: 48,
              padding: "0 20px",
              borderRadius: 16,
              border: 0,
              background: "#0095f6",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            Обновить
          </button>
        </div>
      </body>
    </html>
  );
}
