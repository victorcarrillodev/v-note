use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};

/// Dirección de la ventana de recordatorio (RF-11). Los textos van codificados: el título es contenido de la persona usuaria.
pub fn reminder_url(workspace_id: &str, page_id: &str, task_id: &str, title: &str, when: &str) -> String {
    let e = |s: &str| utf8_percent_encode(s, NON_ALPHANUMERIC).to_string();
    format!("index.html?reminder=1&ws={}&page={}&task={}&title={}&when={}", e(workspace_id), e(page_id), e(task_id), e(title), e(when))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codifica_los_textos_para_que_no_rompan_la_direccion() {
        let u = reminder_url("w1", "p1", "t1", "Pagar luz & agua=?#", "2026-03-05 09:00");
        assert_eq!(u, "index.html?reminder=1&ws=w1&page=p1&task=t1&title=Pagar%20luz%20%26%20agua%3D%3F%23&when=2026%2D03%2D05%2009%3A00");
        assert_eq!(u.matches('&').count(), 5, "el título no puede introducir parámetros nuevos");
        assert!(!u.contains('#'));
    }

    #[test]
    fn un_titulo_malicioso_queda_inerte() {
        let u = reminder_url("w", "p", "t", "x&reminder=0&ws=otro", "");
        assert!(!u.contains("&ws=otro"));
    }

    #[test]
    fn acentos_y_emojis_se_codifican_en_utf8() {
        assert!(reminder_url("w", "p", "t", "Reunión ✅", "").contains("Reuni%C3%B3n%20%E2%9C%85"));
    }
}
