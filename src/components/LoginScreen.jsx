import styles from './LoginScreen.module.css'

export function LoginScreen({ onLogin }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <span className={styles.icon}>◎</span>
        <h1 className={styles.title}>Toki</h1>
        <p className={styles.sub}>Seu assistente pessoal de voz</p>
        <button className={styles.googleBtn} onClick={onLogin}>
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/>
            <path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.1 19.1 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.7 7.4 6.3 14.7z"/>
            <path fill="#FBBC05" d="M24 46c5.8 0 10.8-1.9 14.8-5.2l-6.8-5.6C29.9 36.6 27.1 37.5 24 37.5c-6 0-11.1-4-12.9-9.5l-7 5.4C7.9 41.2 15.4 46 24 46z"/>
            <path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.9 2.9-2.8 5.4-5.3 7.1l6.8 5.6C41.5 37.4 45 31.2 45 24c0-1.3-.2-2.7-.5-4z"/>
          </svg>
          Entrar com Google
        </button>
        <p className={styles.hint}>Seus agendamentos ficam salvos no Google Agenda e sincronizados em todos os dispositivos.</p>
      </div>
    </div>
  )
}
