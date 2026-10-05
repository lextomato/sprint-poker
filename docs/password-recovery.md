# Recuperacion de contrasena

La API envia el correo por SMTP. Para volumen bajo se puede usar una cuenta Gmail personal con una contrasena de aplicacion; no uses la contrasena normal de Google ni la incluyas en el repositorio.

1. Activa la verificacion en dos pasos de la cuenta Gmail emisora.
2. Genera una contrasena de aplicacion desde la seguridad de la cuenta Google.
3. En el `.env` privado del servidor configura `SMTP_USER` con el correo Gmail y `SMTP_PASSWORD` con esa contrasena de aplicacion.
4. Configura `SMTP_FROM` con un remitente como `Sprint Poker <tu-cuenta@gmail.com>` y `WEB_APP_URL` con el origen publico correcto.
5. Mantén `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587` y `SMTP_SECURE=false` para STARTTLS.
6. Reinicia la API y verifica el flujo desde la pantalla de acceso.

Gmail es adecuado para pruebas y poco volumen; para envios habituales conviene migrar a un proveedor transaccional para mejorar limites, entrega y reputacion del dominio.

Los enlaces vencen a los 30 minutos. La base de datos solo almacena el hash del token, y al usarlo se invalidan las sesiones existentes.
