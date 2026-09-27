export const UI = {
  uk: {
    loadingSpace: 'Завантажуємо ваш простір…', courses: 'Курси', yourPath: 'ВАШ ШЛЯХ', free: 'БЕЗКОШТОВНО', paid: 'ПЛАТНИЙ КУРС', accessActive: 'ДОСТУП АКТИВНИЙ',
    steps: 'кроків', openCourse: 'Відкрити курс', continueCourse: 'Продовжити курс', buyForever: 'Придбати назавжди', allPaid: 'Усі платні курси',
    monthlyAll: 'Щомісячний доступ до всіх наявних платних курсів.', supportAuthor: 'Підтримати автора', donateNote: 'Донат — лише за бажанням.',
    terms: 'Умови', paymentSupport: 'Підтримка платежів', admin: 'Адмінка', language: 'Мова', backCourses: '← Курси', start: 'Розпочати шлях',
    firstImmediate: 'Крок 1 відкриється одразу після старту. Після його виконання наступний крок стане доступним лише наступного навчального дня об',
    nextStep: 'НАСТУПНИЙ КРОК', stillLocked: 'ще закритий', missedDays: 'ПАУЗА 5+ ДНІВ', restart: 'Почати з Кроку 1', complete: 'Завершити крок', share: 'Поділитися',
    courseFinished: 'Курс завершено', myCourses: 'Мої курси', subscriptionActive: 'Підписка активна до', noCourses: 'У цьому просторі поки немає опублікованих курсів.'
  },
  ru: {
    loadingSpace: 'Загружаем ваше пространство…', courses: 'Курсы', yourPath: 'ВАШ ПУТЬ', free: 'БЕСПЛАТНО', paid: 'ПЛАТНЫЙ КУРС', accessActive: 'ДОСТУП АКТИВЕН',
    steps: 'шагов', openCourse: 'Открыть курс', continueCourse: 'Продолжить курс', buyForever: 'Купить навсегда', allPaid: 'Все платные курсы',
    monthlyAll: 'Ежемесячный доступ ко всем доступным платным курсам.', supportAuthor: 'Поддержать автора', donateNote: 'Донат — только по желанию.',
    terms: 'Условия', paymentSupport: 'Поддержка платежей', admin: 'Админка', language: 'Язык', backCourses: '← Курсы', start: 'Начать путь',
    firstImmediate: 'Шаг 1 откроется сразу после старта. После его выполнения следующий шаг станет доступен только на следующий учебный день в',
    nextStep: 'СЛЕДУЮЩИЙ ШАГ', stillLocked: 'ещё закрыт', missedDays: 'ПАУЗА 5+ ДНЕЙ', restart: 'Начать с Шага 1', complete: 'Завершить шаг', share: 'Поделиться',
    courseFinished: 'Курс завершён', myCourses: 'Мои курсы', subscriptionActive: 'Подписка активна до', noCourses: 'В этом пространстве пока нет опубликованных курсов.'
  }
};

export function t(locale, key) {
  return UI[locale]?.[key] ?? UI.uk[key] ?? key;
}
