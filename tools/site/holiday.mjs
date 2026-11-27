// Holiday season by date (operator 2026-11-21: holiday landing page, Thanksgiving week now,
// Christmas and New Year from Mon 11-30). GitHub Pages serves static files, so the season is
// picked in the visitor's browser. The build inlines SEASONS and seasonFor() into the home
// strip and the holiday page, so this file is the one place the dates live and the tests run
// the same function the pages run. Dates are calendar days in Augusta (America/New_York),
// both ends included. Update SEASONS for next year's holidays.
// Where the holiday page lives. build.mjs publishes it and claim-guard.mjs's publicPages() guards it.
export const HOLIDAY_URL = { en: '/holidays/', es: '/es/fiestas/' };

export const SEASONS = [
  { id: 'thanks', from: '2026-11-23', to: '2026-11-29' },
  { id: 'winter', from: '2026-11-30', to: '2027-01-06' },
];

// Plain ES5 on purpose: build.mjs inlines this function's source text into the pages.
export function seasonFor(ymd, seasons) {
  for (var i = 0; i < seasons.length; i++) {
    if (ymd >= seasons[i].from && ymd <= seasons[i].to) return seasons[i].id;
  }
  return null;
}

// "YYYY-MM-DD" for an instant, as the calendar date in Augusta.
export function augustaDate(when) {
  var p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(when);
  var get = function (t) { for (var i = 0; i < p.length; i++) if (p[i].type === t) return p[i].value; return ''; };
  return get('year') + '-' + get('month') + '-' + get('day');
}

// The inline script both pages carry. It shows the elements marked data-season="<id>" for
// today's season and hides those marked data-season="default"; with no season it changes
// nothing, so the no-JS markup (default copy, strip hidden) is what shows.
// ?season=thanks|winter|none previews a season (for review screenshots); it never persists.
export function seasonScript(scope) {
  return '<script>(function(){try{' +
    'var S=' + JSON.stringify(SEASONS) + ';' +
    'var seasonFor=' + seasonFor.toString() + ';' +
    'var augustaDate=' + augustaDate.toString() + ';' +
    'var q=(location.search.match(/[?&]season=(thanks|winter|none)\\b/)||[])[1];' +
    'var s=q?(q==="none"?null:q):seasonFor(augustaDate(new Date()),S);' +
    'if(!s)return;' +
    'var root=document.querySelector(' + JSON.stringify(scope) + ');if(!root)return;' +
    'root.hidden=false;root.setAttribute("data-season-now",s);' +
    'root.querySelectorAll("[data-season]").forEach(function(el){el.hidden=el.getAttribute("data-season")!==s;});' +
    '}catch(e){}})();</script>';
}
