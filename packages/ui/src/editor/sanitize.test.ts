// T-129, T-130 (prueba primero): todo HTML pegado o importado se sanea; nunca llega código ejecutable al documento (CL-24).
import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./sanitize";

const dangerous = (html: string) => {
  const d = document.createElement("div");
  d.innerHTML = html;
  const bad: string[] = [];
  d.querySelectorAll("*").forEach((el) => {
    if (/^(script|iframe|object|embed|style|link|meta|base|form|input|button|svg|math|template|frame|frameset|applet)$/i.test(el.tagName)) bad.push(el.tagName);
    for (const a of Array.from(el.attributes)) {
      if (/^on/i.test(a.name)) bad.push(`attr:${a.name}`);
      if (/^(href|src|xlink:href|action|formaction|srcset|data|style)$/i.test(a.name) && /^\s*(javascript|vbscript|data:text\/html)/i.test(a.value)) bad.push(`url:${a.name}`);
      if (a.name.toLowerCase() === "style") bad.push("attr:style");
    }
  });
  return bad;
};

describe("conserva el formato legítimo", () => {
  it("títulos, párrafos, énfasis, listas, tablas, citas, código y enlaces seguros", () => {
    const html = '<h1>T</h1><p>a <strong>b</strong> <em>c</em> <code>d</code></p><ul><li>x</li></ul><ol><li>y</li></ol>' +
      '<blockquote>q</blockquote><pre><code>z</code></pre><table><tbody><tr><td>1</td></tr></tbody></table><a href="https://example.com/x">l</a>';
    const out = sanitizeHtml(html);
    for (const tag of ["h1", "strong", "em", "code", "ul", "ol", "li", "blockquote", "pre", "table", "td", "a"]) expect(out).toContain(`<${tag}`);
    expect(out).toContain('href="https://example.com/x"');
  });
  it("conserva imágenes con http(s) y data:image", () => {
    expect(sanitizeHtml('<img src="https://example.com/a.png" alt="a">')).toContain("<img");
    expect(sanitizeHtml('<img src="data:image/png;base64,iVBORw0KGgo=">')).toContain("<img");
  });
  it("texto plano pasa igual", () => {
    expect(sanitizeHtml("hola")).toBe("hola");
  });
});

describe("corpus de entradas maliciosas (T-130)", () => {
  const corpus: Record<string, string> = {
    script: '<p>hola</p><script>alert(1)</script>',
    "script con mayúsculas y espacios": '<ScRiPt\n>alert(1)</ScRiPt >',
    "img onerror": '<img src=x onerror="alert(1)">',
    "img onerror sin comillas": "<img src=x onerror=alert(1)>",
    "a javascript:": '<a href="javascript:alert(1)">x</a>',
    "a javascript: con entidades": '<a href="jav&#x61;script:alert(1)">x</a>',
    "a javascript: con tabulador": '<a href="java\tscript:alert(1)">x</a>',
    "a vbscript:": '<a href="vbscript:msgbox(1)">x</a>',
    "a data:text/html": '<a href="data:text/html,<script>alert(1)</script>">x</a>',
    iframe: '<iframe src="https://evil.example"></iframe>',
    "iframe srcdoc": '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    object: '<object data="javascript:alert(1)"></object>',
    embed: '<embed src="javascript:alert(1)">',
    "svg onload": '<svg onload="alert(1)"><circle/></svg>',
    "svg script": "<svg><script>alert(1)</script></svg>",
    "svg use": '<svg><use xlink:href="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="/></svg>',
    "math mutation": "<math><mtext><table><mglyph><style><!--</style><img title=\"--&gt;&lt;img src=1 onerror=alert(1)&gt;\">",
    "style con expression": '<p style="width:expression(alert(1))">x</p>',
    "style con url javascript": '<p style="background:url(javascript:alert(1))">x</p>',
    "etiqueta style": "<style>@import 'https://evil.example/x.css';</style><p>x</p>",
    "link stylesheet": '<link rel="stylesheet" href="https://evil.example/x.css">',
    "meta refresh": '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
    base: '<base href="https://evil.example/">',
    "form action": '<form action="javascript:alert(1)"><input type="submit"></form>',
    "button formaction": '<form><button formaction="javascript:alert(1)">x</button></form>',
    "on* en etiqueta válida": '<p onclick="alert(1)" onmouseover="alert(2)">x</p>',
    "body onload": '<body onload="alert(1)">x</body>',
    "details ontoggle": '<details open ontoggle="alert(1)">x</details>',
    "video onerror": '<video><source onerror="alert(1)"></video>',
    "noscript": "<noscript><p title=\"</noscript><img src=x onerror=alert(1)>\"></noscript>",
    "comentario condicional": "<!--[if IE]><script>alert(1)</script><![endif]-->",
    "template": "<template><script>alert(1)</script></template>",
    "href con espacios iniciales": '<a href="  javascript:alert(1)">x</a>',
    "anidado roto": "<scr<script>ipt>alert(1)</scr</script>ipt>",
    "xml/cdata": "<![CDATA[<script>alert(1)</script>]]>",
    "DOM clobbering": '<form id="x"><input name="attributes"></form><img name="body">',
  };
  for (const [name, html] of Object.entries(corpus)) {
    it(`neutraliza: ${name}`, () => {
      const out = sanitizeHtml(html);
      expect(dangerous(out), out).toEqual([]);
      expect(out).not.toMatch(/<script|onerror\s*=|onload\s*=|javascript:/i);
    });
  }
  it("el texto legítimo alrededor del ataque sobrevive", () => {
    expect(sanitizeHtml("<p>hola</p><script>alert(1)</script><p>adiós</p>")).toMatch(/hola[\s\S]*adiós/);
  });
  it("es idempotente: sanear dos veces da lo mismo", () => {
    for (const html of Object.values(corpus)) {
      const once = sanitizeHtml(html);
      expect(sanitizeHtml(once)).toBe(once);
    }
  });
});

describe("estilos propios del editor al pegar", () => {
  it("conserva `data-style-type` y `data-value` (subrayado con estilo) y sigue quitando el resto de atributos data-*", () => {
    const out = sanitizeHtml('<span data-style-type="underlineStyle" data-value="marker:pink" data-x="1" onclick="y()">hola</span>');
    expect(out).toContain('data-style-type="underlineStyle"');
    expect(out).toContain('data-value="marker:pink"');
    expect(out).not.toContain("data-x");
    expect(out).not.toContain("onclick");
  });
});
