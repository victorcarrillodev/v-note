//! Tic nativo para los respaldos programados (RF-15): un evento por minuto y un evento extra al reanudar tras una suspensión.
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

pub const TICK_EVENT: &str = "vnote://tick";
pub const RESUME_EVENT: &str = "vnote://resume";
pub static EMITTED: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, PartialEq)]
pub enum Kind {
    Tick,
    /// Pasó mucho más que el intervalo (el equipo estuvo suspendido): hay que revisar de inmediato.
    Resume,
}

/// Clasifica el tiempo transcurrido desde el último tic. Más de dos intervalos significa que el sistema durmió.
pub fn classify(elapsed: Duration, interval: Duration) -> Kind {
    if elapsed > interval * 2 { Kind::Resume } else { Kind::Tick }
}

/// Intervalo configurable por entorno (solo para pruebas automáticas); por defecto, un minuto.
pub fn interval_from(env: Option<String>) -> Duration {
    env.and_then(|v| v.parse::<u64>().ok()).filter(|ms| *ms >= 50).map(Duration::from_millis).unwrap_or(Duration::from_secs(60))
}

pub fn spawn<F: Fn(Kind) + Send + 'static>(interval: Duration, emit: F) {
    std::thread::spawn(move || {
        let mut last = Instant::now();
        loop {
            std::thread::sleep(interval);
            let kind = classify(last.elapsed(), interval);
            last = Instant::now();
            EMITTED.fetch_add(1, Ordering::SeqCst);
            emit(kind);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_normal_gap_is_a_tick() {
        assert_eq!(classify(Duration::from_secs(60), Duration::from_secs(60)), Kind::Tick);
        assert_eq!(classify(Duration::from_secs(119), Duration::from_secs(60)), Kind::Tick);
    }
    #[test]
    fn a_long_gap_means_the_system_slept() {
        assert_eq!(classify(Duration::from_secs(600), Duration::from_secs(60)), Kind::Resume);
        assert_eq!(classify(Duration::from_secs(121), Duration::from_secs(60)), Kind::Resume);
    }
    #[test]
    fn interval_defaults_to_one_minute_and_rejects_nonsense() {
        assert_eq!(interval_from(None), Duration::from_secs(60));
        assert_eq!(interval_from(Some("abc".into())), Duration::from_secs(60));
        assert_eq!(interval_from(Some("5".into())), Duration::from_secs(60)); // demasiado rápido: se ignora
        assert_eq!(interval_from(Some("500".into())), Duration::from_millis(500));
    }
    #[test]
    fn the_ticker_emits_repeatedly() {
        use std::sync::{Arc, Mutex};
        let got = Arc::new(Mutex::new(Vec::new()));
        let g = got.clone();
        spawn(Duration::from_millis(60), move |k| g.lock().unwrap().push(k));
        std::thread::sleep(Duration::from_millis(400));
        assert!(got.lock().unwrap().len() >= 3);
    }
}
