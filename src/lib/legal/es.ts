import type { LegalContent } from "./types";

export const es: LegalContent = {
  updated: "Última actualización",
  agreeStore: "Al crear una tienda aceptas:",
  privacy: {
    title: "Política de privacidad",
    intro:
      "Fellogram es una app de fidelización que funciona dentro de Telegram. Esta política explica qué recogemos, para qué, quién puede verlo y cómo puedes borrarlo. La hemos escrito breve y clara a propósito.",
    sections: [
      {
        heading: "Qué recogemos",
        bullets: [
          "De Telegram, al abrir la app: tu ID de Telegram, nombre y apellido, nombre de usuario, enlace a tu foto de perfil e idioma.",
          "Tu actividad: las tarjetas de fidelización a las que te unes, los sellos, las recompensas y ofertas que usas, y las recomendaciones que haces o recibes.",
          "Si activas las notificaciones: esa elección y un registro de los recordatorios que te enviamos.",
          "Para dueños y cajeros: el nombre y logo de la tienda, el programa de fidelización, las ofertas, los miembros del equipo y las invitaciones que creas.",
          "En tu dispositivo: tu sesión y tus preferencias (idioma, apariencia, tamaño de texto, sonidos) se guardan en el almacenamiento del navegador de la app de Telegram. No usamos cookies publicitarias ni rastreadores.",
          "Registros técnicos: nuestros proveedores de alojamiento y base de datos guardan registros habituales del servidor (como la dirección IP y la hora) para mantener el servicio seguro y en funcionamiento.",
        ],
        paragraphs: [
          "No pedimos tu teléfono, correo, ubicación, contactos ni datos de pago. La cámara solo se usa cuando pulsas un botón de escaneo, solo para leer un código QR, y las imágenes no se guardan ni se suben.",
        ],
      },
      {
        heading: "Cómo lo usamos",
        bullets: [
          "Para gestionar tus tarjetas, sellos, recompensas y ofertas.",
          "Para mostrar tu nombre a las tiendas donde tienes tarjeta, para que sus cajeros puedan reconocerte.",
          "Para enviarte los recordatorios y avisos de recompensa que has aceptado.",
          "Para prevenir fraudes y abusos, por ejemplo con códigos QR de un solo uso y límites de uso.",
          "Para mantener el servicio seguro, corregir errores y responder a tus mensajes.",
        ],
        paragraphs: ["No vendemos tus datos ni los usamos para publicidad."],
      },
      {
        heading: "Quién puede verlo",
        bullets: [
          "Las tiendas donde tienes tarjeta ven tu nombre, usuario, saldo de sellos y tu actividad en esa tienda. No ven tu actividad en otras tiendas.",
          "El dueño de una tienda también ve lo que hicieron sus cajeros, como los sellos dados y cómo.",
          "Otros clientes no pueden ver tus datos.",
          "Proveedores que tratan datos por nosotros: Supabase (base de datos e inicio de sesión), Vercel (alojamiento) y Telegram (la plataforma y los mensajes del bot), cada uno con sus propias condiciones.",
          "Las autoridades, solo cuando la ley lo exija.",
        ],
      },
      {
        heading: "Las tiendas también son responsables",
        paragraphs: [
          "Cada tienda decide cómo gestionar su programa. Las tiendas pueden ver los datos anteriores de sus propios clientes y deben usarlos solo para gestionar ese programa. Para dudas sobre el programa de una tienda, contacta directamente con ella.",
        ],
      },
      {
        heading: "Notificaciones",
        paragraphs: [
          "Los mensajes llegan desde nuestro bot de Telegram, y solo si activaste las notificaciones. Puedes desactivarlas cuando quieras en Ajustes. Una tienda puede enviar a un mismo cliente como máximo un recordatorio cada 14 días.",
        ],
      },
      {
        heading: "Cuánto tiempo lo guardamos y cómo borrarlo",
        paragraphs: [
          "Guardamos tus datos mientras exista tu cuenta. Puedes borrarlos tú mismo en cualquier momento: Ajustes → Tus datos → Eliminar mi cuenta y mis datos. Esto elimina de inmediato tu perfil, tarjetas, sellos, historial, recomendaciones y registros de notificaciones del sistema en uso, y no se puede deshacer.",
          "Si solo quitas la tarjeta de una tienda, esa tienda conserva su registro de sellos anterior; elimina tu cuenta para borrar todo. Si el dueño de una tienda la elimina, se borran su programa y todas las tarjetas de esa tienda.",
          "Las copias de seguridad que guarda nuestro proveedor de base de datos se sobrescriben según su ciclo normal, y después los datos desaparecen. Nuestros proveedores guardan los registros técnicos durante poco tiempo.",
        ],
      },
      {
        heading: "Tus opciones y derechos",
        paragraphs: [
          "Puedes pedir ver, corregir o borrar tus datos, u oponerte a cómo los usamos. Borrar está disponible en la app; para cualquier otra cosa, contáctanos. Según dónde vivas, leyes como el RGPD u otras similares pueden darte estos derechos, y tratamos estas solicitudes igual para todos.",
        ],
      },
      {
        heading: "Seguridad",
        paragraphs: [
          "Las conexiones están cifradas. Las reglas de acceso hacen que cada cliente solo vea sus propios datos, y los códigos QR son de un solo uso y de corta duración. Ningún sistema es perfectamente seguro, así que no podemos prometer una seguridad absoluta.",
        ],
      },
      {
        heading: "Otros países",
        paragraphs: ["Nuestros proveedores pueden tratar datos en países distintos del tuyo."],
      },
      {
        heading: "Menores",
        paragraphs: [
          "Fellogram no está pensado para menores de 13 años, ni para menores de la edad que exijan Telegram o tu ley local. Si descubrimos que tenemos datos de un menor sin permiso, los eliminamos.",
        ],
      },
      {
        heading: "Cambios",
        paragraphs: ["Si cambiamos esta política, actualizamos la fecha de arriba y te avisamos en la app cuando el cambio sea importante."],
      },
    ],
    contact: {
      heading: "Contacto",
      withEmail: "Preguntas o solicitudes sobre tus datos: {email}",
      withoutEmail: "Preguntas o solicitudes sobre tus datos: usa la página de Ayuda y preguntas frecuentes en la app.",
    },
  },
  terms: {
    title: "Términos de uso",
    intro: "Estos términos se aplican cuando usas Fellogram, la app y el bot de Telegram para tarjetas de fidelización digitales. Al usarlo, los aceptas. Si no estás de acuerdo, no lo uses.",
    sections: [
      {
        heading: "Qué es Fellogram",
        paragraphs: [
          "Fellogram permite a las tiendas gestionar tarjetas de fidelización digitales dentro de Telegram. Las tiendas, no Fellogram, ofrecen las recompensas y ofertas y fijan sus reglas. No somos parte de lo que ocurra entre una tienda y sus clientes.",
        ],
      },
      {
        heading: "Tu cuenta",
        bullets: [
          "Inicias sesión a través de Telegram. Eres responsable de lo que ocurra en tu cuenta, así que mantén segura tu cuenta de Telegram.",
          "Una cuenta por persona, con información veraz.",
          "Las tiendas aceptan estos términos en nombre de su negocio.",
        ],
      },
      {
        heading: "Para clientes",
        bullets: [
          "Los sellos y recompensas los fija cada tienda y no tienen valor en efectivo.",
          "Una tienda puede cambiar o terminar su programa u ofertas, y las recompensas están sujetas a las condiciones de esa tienda.",
          "Tu código QR es personal y de corta duración. No lo uses para conseguir sellos que no te corresponden.",
        ],
      },
      {
        heading: "Para tiendas y su personal",
        bullets: [
          "Eres responsable de tu programa, tus ofertas, las recompensas que prometes y la conducta de tus cajeros. Cumple las recompensas que ofreces.",
          "Da sellos solo por compras o visitas reales. No selles a personas que no están presentes, e invita solo a quien te inspire confianza.",
          "Usa los datos de los clientes solo para gestionar tu programa, según la Política de privacidad, y cumple las leyes que te apliquen.",
        ],
      },
      {
        heading: "Uso aceptable",
        lead: "Te comprometes a no:",
        bullets: [
          "Falsificar, acumular artificialmente o comerciar con sellos, ni reutilizar o compartir códigos QR para obtenerlos.",
          "Usar bots o scripts, extraer datos del servicio, ni intentar romperlo, sobrecargarlo o aplicarle ingeniería inversa.",
          "Acceder a datos de otras personas ni suplantar a nadie.",
          "Publicar contenido ilegal, ofensivo o engañoso, como nombres de tienda u ofertas.",
          "Usar los recordatorios para enviar spam.",
        ],
      },
      {
        heading: "Planes de pago",
        paragraphs: ["Fellogram es gratuito por ahora. Si introducimos planes de pago, te avisaremos antes de cualquier cobro y podrás decidir no continuar."],
      },
      {
        heading: "Disponibilidad y cambios",
        paragraphs: [
          "El servicio se ofrece tal cual y según disponibilidad. Podemos cambiar, pausar o retirar funciones, e intentaremos avisar de los cambios importantes.",
        ],
      },
      {
        heading: "Suspensión y fin",
        paragraphs: [
          "Podemos suspender o eliminar cuentas o tiendas que incumplan estos términos o pongan en riesgo a otros. Puedes eliminar tu cuenta cuando quieras en Ajustes; tus datos se tratarán entonces como indica la Política de privacidad.",
        ],
      },
      {
        heading: "Responsabilidad",
        paragraphs: [
          "En la medida que permita la ley, no respondemos de pérdidas indirectas, lucro cesante o pérdida de datos, ni de lo que hagan o dejen de hacer tiendas o clientes. Nuestra responsabilidad total hacia ti se limita a lo que nos hayas pagado en los 12 meses anteriores, que ahora mismo es nada. Nada de esto limita derechos que la ley no permita limitar.",
        ],
      },
      {
        heading: "Cambios en estos términos",
        paragraphs: ["Si cambiamos estos términos, actualizamos la fecha de arriba. Usar Fellogram después de un cambio significa que aceptas los nuevos términos."],
      },
    ],
    contact: {
      heading: "Contacto",
      withEmail: "Preguntas sobre estos términos: {email}",
      withoutEmail: "Preguntas sobre estos términos: usa la página de Ayuda y preguntas frecuentes en la app.",
    },
  },
};
