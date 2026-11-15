import LektrusFeedbackForm from "./LektrusFeedbackForm";

export default function FeedbackScreen(){
 return <main className="lektrus-feedback-screen">
  <header className="lektrus-feedback-screen-head"><span>НА СВЯЗИ</span><h1>Отзывы и предложения</h1><p>Поделитесь идеей, задайте вопрос или расскажите, что стоит улучшить.</p></header>
  <div className="lektrus-feedback-screen-grid">
   <section className="lektrus-feedback-contact-card">
    <span className="lektrus-feedback-contact-icon" aria-hidden="true">✦</span>
    <h2>Помогите сделать Lektrus лучше</h2>
    <p>Сообщение увидит команда проекта. Если вы оставите email, мы сможем ответить лично.</p>
    <a className="lektrus-feedback-telegram-card" href="https://t.me/lektrus" target="_blank" rel="noopener noreferrer" aria-label="Написать Lektrus в Telegram, @lektrus (откроется в новой вкладке)">
     <span className="lektrus-feedback-telegram-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="23" height="23" fill="currentColor"><path d="m21.43 3.62-3.25 15.32c-.25 1.08-.89 1.35-1.8.84l-4.98-3.67-2.4 2.32c-.27.27-.49.5-1.01.5l.36-5.08 9.25-8.36c.4-.36-.09-.56-.62-.2L5.55 12.5.63 10.96c-1.07-.34-1.09-1.07.22-1.58l19.26-7.43c.89-.33 1.67.21 1.32 1.67Z"/></svg></span>
     <span className="lektrus-feedback-telegram-copy"><strong>Написать в Telegram</strong><small>@lektrus</small></span>
     <span className="lektrus-feedback-telegram-arrow" aria-hidden="true">↗</span>
    </a>
    <div className="lektrus-feedback-privacy">Ваше сообщение через форму доступно только администраторам Lektrus.</div>
   </section>
   <section className="lektrus-feedback-app-card"><LektrusFeedbackForm compact source="app"/></section>
  </div>
 </main>;
}
