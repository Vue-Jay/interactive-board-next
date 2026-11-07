import LektrusFeedbackForm from "./LektrusFeedbackForm";

export default function FeedbackScreen(){
 return <main className="lektrus-feedback-screen">
  <header className="lektrus-feedback-screen-head"><span>НА СВЯЗИ</span><h1>Отзывы и предложения</h1><p>Поделитесь идеей, задайте вопрос или расскажите, что стоит улучшить.</p></header>
  <div className="lektrus-feedback-screen-grid">
   <section className="lektrus-feedback-contact-card"><span className="lektrus-feedback-contact-icon" aria-hidden="true">✦</span><h2>Помогите сделать Lektrus лучше</h2><p>Сообщение увидит команда проекта. Если вы оставите email, мы сможем ответить лично.</p><div className="lektrus-feedback-privacy">Ваше сообщение доступно только администраторам Lektrus.</div></section>
   <section className="lektrus-feedback-app-card"><LektrusFeedbackForm compact source="app"/></section>
  </div>
 </main>;
}
