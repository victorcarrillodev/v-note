// Emojis del selector de ícono: grupos con palabras clave en español e inglés para la búsqueda. Sin dependencias ni red.
// Formato de cada entrada: «emoji palabras clave…» (el primer término es el emoji).
export type EmojiGroup = { id: "faces" | "people" | "nature" | "food" | "travel" | "activities" | "objects" | "symbols"; items: string[] };

export const EMOJI_GROUPS: EmojiGroup[] = [
  { id: "faces", items: [
    "😀 feliz sonrisa smile happy", "😃 feliz alegre grin", "😄 risa sonrisa laugh", "😁 sonrisa dientes beam", "😆 risa laugh", "😅 sudor risa sweat", "🤣 carcajada rofl",
    "😂 lagrimas risa joy", "🙂 sonrisa suave slight", "😉 guiño wink", "😊 sonrojo blush", "😇 angel halo", "🥰 amor love", "😍 enamorado corazones heart eyes", "🤩 estrellas star struck",
    "😘 beso kiss", "😋 rico yum", "😛 lengua tongue", "😜 loco guiño crazy", "🤪 loco zany", "🤗 abrazo hug", "🤔 pensar think", "🤫 silencio shush", "🤨 duda ceja skeptic",
    "😐 neutral", "😶 sin boca mute", "😏 picaro smirk", "😒 fastidio unamused", "🙄 ojos en blanco roll eyes", "😬 mueca grimace", "😌 alivio relieved", "😔 triste pensive", "😴 dormir sleep",
    "🤒 enfermo sick", "🤯 mente explotada mind blown", "🥳 fiesta party", "😎 genial cool gafas sunglasses", "🤓 nerd estudio", "🧐 monoculo curioso", "😕 confuso confused", "😟 preocupado worried",
    "😢 llorar cry", "😭 llanto sob", "😱 miedo scream", "😡 enojo angry", "🥺 suplica pleading", "😈 diablo devil", "💀 calavera skull", "👻 fantasma ghost", "🤖 robot", "👽 alien extraterrestre",
  ] },
  { id: "people", items: [
    "👍 bien pulgar thumbs up", "👎 mal pulgar thumbs down", "👏 aplauso clap", "🙌 celebrar hands", "🙏 gracias rezar pray", "🤝 trato handshake", "💪 fuerza muscle", "👋 saludo hola wave",
    "✌️ paz victoria peace", "🤞 suerte fingers crossed", "👌 ok perfecto", "☝️ arriba point up", "👉 derecha point right", "👀 ojos eyes", "🧠 cerebro brain mente", "👤 persona usuario user",
    "👥 personas grupo users", "🧑‍💻 programador developer", "👨‍💻 programador developer", "👩‍💻 programadora developer", "🧑‍🎓 estudiante student", "🧑‍🏫 maestro teacher", "🧑‍🔬 cientifico scientist",
    "🧑‍🎨 artista artist", "🦸 heroe hero", "🧙 mago wizard", "👶 bebe baby",
  ] },
  { id: "nature", items: [
    "🐶 perro dog", "🐱 gato cat", "🐭 raton mouse", "🐰 conejo rabbit", "🦊 zorro fox", "🐻 oso bear", "🐼 panda", "🐨 koala", "🐯 tigre tiger", "🦁 leon lion", "🐮 vaca cow", "🐷 cerdo pig",
    "🐸 rana frog", "🐵 mono monkey", "🐔 gallina chicken", "🐧 pinguino penguin", "🐦 pajaro bird", "🦉 buho owl", "🦋 mariposa butterfly", "🐝 abeja bee", "🐛 gusano bug insecto", "🐢 tortuga turtle",
    "🐍 serpiente python snake", "🐙 pulpo octopus", "🐬 delfin dolphin", "🐳 ballena whale", "🦈 tiburon shark", "🌱 planta brote seedling", "🌲 arbol pino tree", "🌳 arbol tree", "🌴 palmera palm",
    "🌵 cactus", "🌷 tulipan flor tulip", "🌹 rosa rose", "🌻 girasol sunflower", "🍀 trebol clover", "🍁 hoja otono maple", "🌍 mundo tierra earth", "🌙 luna moon", "⭐ estrella star", "🌟 brillante glowing star",
    "☀️ sol sun", "⛅ nublado cloud", "🌧️ lluvia rain", "⚡ rayo lightning", "❄️ nieve snow", "🔥 fuego fire", "💧 gota agua drop", "🌈 arcoiris rainbow", "🌊 ola wave",
  ] },
  { id: "food", items: [
    "🍎 manzana apple", "🍊 naranja orange", "🍋 limon lemon", "🍌 platano banana", "🍉 sandia watermelon", "🍇 uvas grapes", "🍓 fresa strawberry", "🍒 cereza cherry", "🍑 durazno peach", "🥑 aguacate avocado",
    "🍅 tomate tomato", "🌽 maiz corn", "🥕 zanahoria carrot", "🥦 brocoli", "🍞 pan bread", "🧀 queso cheese", "🥚 huevo egg", "🥞 hotcakes pancakes", "🍔 hamburguesa burger", "🍟 papas fries",
    "🍕 pizza", "🌮 taco", "🌯 burrito", "🍝 pasta spaghetti", "🍣 sushi", "🍜 sopa ramen", "🍰 pastel cake", "🍪 galleta cookie", "🍫 chocolate", "🍿 palomitas popcorn", "🍩 dona donut",
    "☕ cafe coffee", "🍵 te tea", "🥤 refresco soda", "🍺 cerveza beer", "🍷 vino wine",
  ] },
  { id: "travel", items: [
    "🚗 auto coche car", "🚕 taxi", "🚌 autobus bus", "🚓 policia police", "🚑 ambulancia", "🚒 bomberos", "🚲 bicicleta bike", "🛵 moto scooter", "🚂 tren train", "✈️ avion plane", "🚀 cohete rocket",
    "🛸 ovni ufo", "⛵ velero sailboat", "🚢 barco ship", "🏠 casa home house", "🏢 edificio office", "🏫 escuela school", "🏥 hospital", "🏛️ museo gobierno", "⛪ iglesia", "🏰 castillo castle",
    "🗽 estatua libertad", "🗼 torre tower", "🌋 volcan", "⛰️ montana mountain", "🏖️ playa beach", "🏝️ isla island", "🌆 ciudad city", "🗺️ mapa map", "🧭 brujula compass", "⛺ campamento camp",
  ] },
  { id: "activities", items: [
    "⚽ futbol soccer", "🏀 basquetbol basketball", "🏈 americano football", "⚾ beisbol baseball", "🎾 tenis tennis", "🏐 voleibol volleyball", "🎱 billar pool", "🏓 ping pong", "🥊 box boxing",
    "🏆 trofeo trophy", "🥇 medalla oro gold medal", "🎯 diana objetivo target", "🎮 videojuego game", "🕹️ joystick", "🎲 dado dice", "♟️ ajedrez chess", "🧩 rompecabezas puzzle", "🎨 arte paleta art",
    "🎬 cine clapper", "🎤 microfono mic", "🎧 audifonos headphones", "🎵 musica music", "🎸 guitarra guitar", "🎹 piano", "🥁 bateria drum", "🎭 teatro theater", "🎪 circo circus", "🎉 fiesta party", "🎁 regalo gift",
  ] },
  { id: "objects", items: [
    "📓 cuaderno notebook", "📔 cuaderno decorado", "📒 libreta ledger", "📕 libro rojo book", "📗 libro verde book", "📘 libro azul book", "📙 libro naranja book", "📚 libros books", "📖 libro abierto open book",
    "📝 nota memo escribir", "✏️ lapiz pencil", "🖊️ pluma pen", "🖍️ crayon", "📌 chincheta pin", "📍 ubicacion pin", "📎 clip", "📁 carpeta folder", "📂 carpeta abierta folder", "🗂️ archivero files",
    "🗃️ caja archivo", "🗄️ gabinete cabinet", "📋 portapapeles clipboard", "📅 calendario calendar", "🗓️ agenda calendar", "📆 calendario", "📈 grafica sube chart up", "📊 grafica barras chart", "📉 grafica baja chart down",
    "💼 maletin briefcase", "💻 laptop computadora computer", "🖥️ escritorio desktop", "⌨️ teclado keyboard", "🖱️ raton mouse", "🖨️ impresora printer", "📱 celular phone", "☎️ telefono phone", "📷 camara camera",
    "📺 television tv", "🔋 bateria battery", "🔌 enchufe plug", "💡 idea foco bulb", "🔦 linterna flashlight", "🔑 llave key", "🔒 candado lock", "🔓 abierto unlock", "🔨 martillo hammer", "🔧 llave inglesa wrench",
    "⚙️ engrane configuracion gear settings", "🧰 caja herramientas toolbox", "🧪 experimento test tube", "🔬 microscopio microscope", "🔭 telescopio telescope", "💊 pastilla pill", "💰 dinero money", "💳 tarjeta card",
    "✉️ correo mail", "📦 paquete package", "🏷️ etiqueta tag", "🔖 marcador bookmark", "🔍 buscar lupa search", "🕐 reloj clock", "⏰ alarma alarm", "⏳ reloj arena hourglass", "🛒 carrito cart", "🧹 escoba broom",
  ] },
  { id: "symbols", items: [
    "❤️ corazon rojo heart", "🧡 corazon naranja heart", "💛 corazon amarillo heart", "💚 corazon verde heart", "💙 corazon azul heart", "💜 corazon morado heart", "🖤 corazon negro heart", "🤍 corazon blanco heart",
    "💔 corazon roto broken heart", "💯 cien hundred", "✅ listo check done", "☑️ casilla check", "❌ cruz cross", "❓ pregunta question", "❗ exclamacion exclamation", "⚠️ advertencia warning", "🚫 prohibido prohibited",
    "♻️ reciclar recycle", "➕ mas plus", "➖ menos minus", "➡️ flecha derecha arrow right", "⬅️ flecha izquierda arrow left", "⬆️ flecha arriba arrow up", "⬇️ flecha abajo arrow down", "🔄 actualizar refresh",
    "🔔 campana bell notificacion", "🔕 silencio mute", "📢 altavoz megaphone", "💬 mensaje chat speech", "💭 pensamiento thought", "🆕 nuevo new", "🆗 ok", "🔴 circulo rojo red", "🟠 circulo naranja orange",
    "🟡 circulo amarillo yellow", "🟢 circulo verde green", "🔵 circulo azul blue", "🟣 circulo morado purple", "⚫ circulo negro black", "⚪ circulo blanco white", "🟥 cuadro rojo", "🟦 cuadro azul", "🟩 cuadro verde",
    "🔶 rombo naranja diamond", "💠 diamante diamond", "✨ brillos sparkles", "🎖️ medalla", "🏁 meta bandera flag", "🚩 bandera roja flag",
  ] },
];

export type EmojiEntry = { char: string; words: string };
export const EMOJIS: { id: EmojiGroup["id"]; entries: EmojiEntry[] }[] = EMOJI_GROUPS.map((g) => ({
  id: g.id,
  entries: g.items.map((line) => { const i = line.indexOf(" "); return { char: line.slice(0, i), words: line.slice(i + 1) }; }),
}));

/** Sin acentos y en minúsculas, para que «corazón» encuentre «corazon». */
export const fold = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Emojis cuyas palabras clave contienen todas las palabras de la consulta. */
export function searchEmojis(query: string): EmojiEntry[] {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return EMOJIS.flatMap((g) => g.entries).filter((e) => terms.every((t) => e.words.includes(t)));
}

export const randomEmoji = (rnd: () => number = Math.random): string => {
  const all = EMOJIS.flatMap((g) => g.entries);
  return all[Math.floor(rnd() * all.length)]!.char;
};
