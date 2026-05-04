"use client";

import Link from "next/link";
import { useAuthModals } from "@/components/auth/AuthModalsContext";
import { t } from "@/lib/i18n";

export default function LandingPage() {
  const { openLogin, openRegister } = useAuthModals();

  return (
    <main className="landing">
      <header className="landingHeader">
        <div className="landingContainer landingHeaderInner">
          <div className="landingLogo">{t("app.title")}</div>
          <nav className="landingNav">
            <a href="#features">Возможности</a>
            <a href="#how">Как это работает</a>
            <a href="#audience">Для кого</a>
            <a href="#cta">Запуск</a>
          </nav>
          <div className="landingActions">
            <button type="button" className="btn btnGhost" onClick={openLogin}>
              Войти
            </button>
            <button type="button" className="btn" onClick={openRegister}>
              Начать
            </button>
          </div>
        </div>
      </header>

      <section className="landingHero">
        <div className="landingContainer">
          <span className="landingBadge">Engineering Process Optimization Platform</span>
          <h1>
            Ускоряйте delivery команды.
            <br />
            Понимайте, где процесс ломается, и что делать прямо сейчас.
          </h1>
          <p className="landingHeroText">
            TeamUp анализирует реальный lifecycle задач в ClickUp и показывает узкие места, задачи с риском и
            конкретные управленческие действия для Engineering Manager, Team Lead и CTO.
          </p>
          <div className="landingHeroActions">
            <button type="button" className="btn" onClick={openRegister}>
              Создать рабочее пространство
            </button>
            <Link className="btn btnGhost" href="/onboarding/clickup">
              Подключить ClickUp
            </Link>
          </div>
        </div>
      </section>

      <section className="landingIntegrations">
        <div className="landingContainer">
          <p className="landingLabel">Интеграции</p>
          <div className="chipRow">
            <span className="chip chipActive">ClickUp (MVP)</span>
            <span className="chip">Яндекс Трекер (Next)</span>
            <span className="chip">Jira (Next)</span>
            <span className="chip">Kaiten (Next)</span>
          </div>
        </div>
      </section>

      <section id="features" className="landingSection">
        <div className="landingContainer">
          <h2>Не просто дашборд. Движок управленческих решений.</h2>
          <p className="sectionText">
            Большинство инструментов показывают метрики. TeamUp объясняет причины, приоритизирует внимание менеджера и
            подсказывает следующий шаг.
          </p>
          <div className="landingGrid3">
            <article className="card landingCard">
              <h3>Attention Engine</h3>
              <p>Список задач, требующих внимания прямо сейчас: застрявшие, зацикленные, просроченные, неактивные.</p>
            </article>
            <article className="card landingCard">
              <h3>Process Intelligence</h3>
              <p>Поиск системных проблем workflow: лишние handoff, узкие места в QA, повторные возвраты в разработку.</p>
            </article>
            <article className="card landingCard">
              <h3>Value / Impact</h3>
              <p>Сравнение baseline и текущего периода: Cycle Time, Time in Status, Rework, Flow Efficiency.</p>
            </article>
          </div>
        </div>
      </section>

      <section id="how" className="landingSection landingSectionAlt">
        <div className="landingContainer">
          <h2>Как это работает</h2>
          <div className="stepsGrid">
            <article className="card stepCard">
              <span>01</span>
              <h3>Подключение</h3>
              <p>Подключаете ClickUp и выбираете рабочую область анализа.</p>
            </article>
            <article className="card stepCard">
              <span>02</span>
              <h3>Маппинг статусов</h3>
              <p>Сопоставляете ваши статусы с универсальными этапами lifecycle.</p>
            </article>
            <article className="card stepCard">
              <span>03</span>
              <h3>Аналитика и сигналы</h3>
              <p>Система строит метрики и выделяет рисковые задачи с объяснением причин.</p>
            </article>
            <article className="card stepCard">
              <span>04</span>
              <h3>Измеримый эффект</h3>
              <p>Смотрите before/after и доказываете реальную ценность изменений процесса.</p>
            </article>
          </div>
        </div>
      </section>

      <section id="audience" className="landingSection">
        <div className="landingContainer">
          <h2>Для кого</h2>
          <div className="landingGrid3">
            <article className="card landingCard">
              <h3>Engineering Manager</h3>
              <p>Получает список приоритетных проблем и фокус на управленческие действия, а не ручные отчеты.</p>
            </article>
            <article className="card landingCard">
              <h3>Team Lead</h3>
              <p>Быстро видит повторные циклы QA ↔ Dev, блокеры и просадки по скорости доставки.</p>
            </article>
            <article className="card landingCard">
              <h3>CTO / Head of Engineering</h3>
              <p>Получает прозрачную картину эффективности процесса и доказательство влияния улучшений.</p>
            </article>
          </div>
        </div>
      </section>

      <section id="cta" className="landingSection landingCta">
        <div className="landingContainer">
          <h2>Готовы увидеть, где теряется скорость разработки?</h2>
          <p className="sectionText">
            Запустите TeamUp для вашей команды, подключите ClickUp и получите первые инсайты уже после импорта истории
            задач.
          </p>
          <div className="landingHeroActions">
            <button type="button" className="btn" onClick={openRegister}>
              Запустить MVP
            </button>
            <button type="button" className="btn btnGhost" onClick={openLogin}>
              Войти в рабочее пространство
            </button>
          </div>
        </div>
      </section>

      <footer className="landingFooter">
        <div className="landingContainer landingFooterInner">
          <span>© {new Date().getFullYear()} TeamUp</span>
          <span className="muted">Сделано для инженерных команд, которым важны скорость, качество и предсказуемость.</span>
        </div>
      </footer>
    </main>
  );
}

