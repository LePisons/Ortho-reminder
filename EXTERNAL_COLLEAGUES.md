# Portal de colegas derivadores

## Funciones de esta primera versión

### Actualización: solicitud clínica y fotografías

- Interfaz con botones principales azules, pestañas por sección y paneles coherentes con la identidad Alnix.
- Solicitud estructurada opcional: objetivos, línea media superior e inferior, attachments, cortes para elásticos, botones/ventanas, IPR/espacios y limitaciones. Son indicaciones del profesional; no se generan recomendaciones automáticas.
- Galería de fotografías con selección múltiple, vista previa, progreso y reintento de cargas fallidas sin repetir las exitosas. Las subidas se realizan secuencialmente por el endpoint autenticado existente.
- Ocho vistas: frontal en reposo, sonrisa, perfil, intraoral frontal, laterales derecha/izquierda y oclusales superior/inferior. También se admite «Sin clasificar».
- La clasificación puede cambiarse después. No modifica ni sobrescribe los originales. Cuando una vista tiene varias fotos, se muestra la más reciente; todas permanecen disponibles en el listado de originales.
- Las imágenes se consultan por la API privada; las vistas previas usan blobs temporales y no un optimizador público.
- Migración aditiva `20261006020000_referral_treatment_photos`: `Referral.treatment` opcional y `ReferralFile.photoView`, con valor inicial `UNASSIGNED` para archivos existentes.
- Validación: 7 pruebas nuevas de campos y clasificación, además de controles HTTP para impedir reclasificar archivos de casos ajenos o revocados. Carga de dos imágenes ficticias, asignación, reclasificación y vista móvil comprobadas con API simulada. Transferencia real a R2 pendiente de prueba con cuenta de ensayo.

### Acceso y flujo de derivaciones

- El administrador crea una cuenta individual desde **Derivaciones → Colegas**.
- La contraseña inicial se muestra una sola vez y debe cambiarse antes de consultar casos. El restablecimiento invalida las sesiones anteriores.
- El colega crea una derivación en borrador con nombre, RUT, correo, teléfono y motivo de derivación. Adjunta STL superior e inferior y luego la envía.
- Ambas partes pueden agregar fotografías/radiografías en JPG, PNG o WebP y comentarios. Máximo 60 MB por archivo y 60 archivos por caso; los originales se conservan sin sobrescribirlos.
- El administrador revisa coincidencias por RUT o contacto, solicita antecedentes, acepta como paciente nuevo **en pausa** o vincula una ficha propia existente.
- La aceptación no ejecuta el alta habitual de pacientes: no crea órdenes, no activa seguimiento, no envía mensajes ni genera tokens de onboarding.
- Los archivos permanecen en la derivación. La ficha interna incluye un enlace a sus registros y conversación; no se duplican en el módulo de modelos ni se comparten automáticamente los archivos internos.
- Se pueden compartir pacientes existentes seleccionando un colega y escribiendo un resumen específico.
- El especialista publica enlaces HTTPS a setups de Titan con un nombre y versión. Son enlaces externos: Orthoreminder no inicia sesión en Titan ni modifica sus permisos.
- El portal muestra únicamente los datos compartidos, los comentarios, los archivos y un resumen del avance (estado y número de alineador). No devuelve la ficha clínica, notas internas, costos ni presupuestos.
- Se puede revocar un caso o deshabilitar toda la cuenta del colega. Reactivar una cuenta no restaura casos revocados.

## Límites de acceso

`REFERRER` tiene una lista explícita de rutas permitidas. Todas las rutas existentes y futuras quedan bloqueadas para ese rol salvo autorización deliberada. Cada consulta comprueba el propietario o colega asignado; los IDs de archivos también deben pertenecer al caso solicitado. El acceso a uploads se comprueba antes de que Multer lea el archivo.

JWT verifica en la base de datos el usuario, su rol actual, la deshabilitación y la versión de sesión en cada petición. Las API keys no se aceptan para colegas. Las escrituras con cookie exigen un Origin incluido en `ALLOWED_ORIGINS`. No se utiliza un correo enviado por el navegador ni un header sin verificar de Cloudflare para atribuir identidad.

Los archivos se guardan privados en R2 y se sirven a través de una ruta autenticada, con `Cache-Control: private, no-store`. La revocación impide solicitudes posteriores; no puede recuperar archivos que alguien ya descargó ni cancelar bytes de una descarga en curso. Los enlaces externos a Titan tienen su propio control de acceso: revócalos allí también si corresponde.

Se registran creación, lectura de detalle, descargas, comentarios, setups, aceptación, revocación y operaciones de cuentas en `AuditLog`. No se registran contraseñas ni contenidos clínicos en esos eventos.

La integración con la app de recorte automático queda pendiente. Los originales inmutables permiten añadir posteriormente derivados y una revisión antes de publicarlos. PDF y otros documentos no están habilitados en esta primera versión.

## Antes de habilitar colegas reales

1. **Despliegue y base de datos.** Respaldar la base, probar primero en un entorno de ensayo, generar el cliente Prisma y aplicar la migración `20261006010000_external_referrals` antes de iniciar la nueva API. El 6 de octubre de 2026 se creó un respaldo local autorizado, se restauró correctamente en PostgreSQL 18 y se probó allí esta migración. Después se aplicó correctamente en producción.
   Tu cuenta debe tener el rol `ADMIN` para ver la gestión de colegas; no se ha cambiado el rol de ninguna cuenta existente.
2. **Configuración de la API.** Confirmar `NODE_ENV=production` y `ALLOWED_ORIGINS=https://tu-dominio-real` (sin barra final; separar con comas si hay más dominios). El navegador conserva las llamadas bajo `/api` en el mismo dominio. El bloqueo de origen afecta también las escrituras internas con cookie, por lo que esta variable debe estar correcta antes del despliegue.
3. **Cloudflare Access.** En la aplicación que protege Orthoreminder, conservar tu correo y agregar únicamente los correos de los colegas aprobados a una política Allow. Usar la identidad/código de correo configurado en Access. No crear una regla Bypass ni permitir cualquier correo por elegir solamente el método One-time PIN. Ver [políticas de Access](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/) y [políticas habituales](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/common-policies/).
4. **Origen protegido.** Mantener la API en la red privada y comprobar que un dominio alternativo del alojamiento no permite eludir Access. Si utilizas Cloudflare Tunnel, configurar Protect with Access para validar el token en el túnel. Ver [protección de una aplicación propia](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/). Esta implementación no reemplaza la protección del origen.
5. **R2 privado.** Confirmar que el bucket no tenga una URL pública habilitada que exponga sus objetos. Las descargas del portal usan la API, no URLs públicas del bucket.
6. **Prueba con dos cuentas ficticias.** Crear dos colegas, cambiar sus contraseñas iniciales, crear un caso con cada uno y comprobar que no puedan abrir el caso ni archivo del otro. Deshabilitar uno y verificar que su sesión abierta pierde acceso. Probar subir ambos STL y aceptar el caso desde tu cuenta. No introducir pacientes reales hasta completar esta prueba en el entorno desplegado.
7. **Entrega de credenciales.** Crear cada cuenta desde la interfaz y entregar su contraseña inicial por un canal privado. Cloudflare y Orthoreminder son dos accesos separados; no se ha implementado SSO ni envío automático de invitaciones.

Comandos de despliegue de referencia (ejecutar en `api`, dentro del proceso habitual de despliegue):

```sh
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm run build
```

La migración agrega tablas y campos; no elimina datos. El script `start:prod` existente también ejecuta `prisma migrate deploy`. Mantener coordinados el despliegue de API y web. No ejecutar seeds de ejemplo sobre producción.

## Verificación local

### Avisos de actividad por correo

Los cambios realizados por cuentas REFERRER generan eventos persistentes en la misma transacción que la acción. Incluyen creación del borrador, cambios en antecedentes/tratamiento, envío a revisión, comentarios, carga de archivos y clasificación de fotos. Las lecturas, descargas y acciones del administrador no envían avisos. No se importan acciones históricas.

Un proceso revisa la cola cada 30 segundos y agrupa las acciones de cada caso desde que el primer evento lleva dos minutos pendiente. Una carga prolongada puede producir más de un resumen. El destinatario es exclusivamente el correo del administrador propietario; antes del envío se vuelve a comprobar su cuenta, correo y acceso al caso. Los avisos contienen tipos de acción y un enlace autenticado, sin nombres de pacientes, comentarios, archivos ni datos clínicos.

Se requieren `RESEND_API_KEY`, `EMAIL_FROM` de un dominio verificado y `ALLOWED_ORIGINS` HTTPS (o `REFERRAL_APP_URL` explícita). La clave se guarda en Railway, nunca en Git. Sin configuración válida, los eventos quedan pendientes. Los fallos de envío se reintentan con espera progresiva y clave estable de idempotencia; el estado SENT significa aceptación por el proveedor, no confirmación de llegada a la bandeja de entrada. El mecanismo permite reintentos tras reinicios; no garantiza entrega exactamente una vez fuera del período de idempotencia del proveedor.

Configuración completada el 8 de octubre: clave y remitente guardados en Railway. Resend aceptó el correo de prueba y el administrador confirmó su recepción. Al aplicar variables Railway reconstruyó una revisión antigua de GitHub; se restauró el paquete probado y se sincronizó el código para evitar recurrencias.

Migración aditiva: `20261007010000_referral_notifications`. No cambia pacientes ni derivaciones existentes. La versión anterior puede funcionar dejando estas tablas presentes. Las 48 pruebas específicas de derivaciones (9 nuevas para avisos) y la compilación de API pasaron.

- 41 pruebas nuevas de flujo, permisos HTTP, sesiones revocadas y origen de solicitudes: aprobadas.
- Comprobación TypeScript de API y web: aprobada.
- Compilación de API y compilación de producción de la web: aprobadas. La web se compiló con `--no-lint` por el problema de instalación de ESLint indicado abajo.
- Prueba de navegador con datos ficticios: bandeja del administrador, colegas, comentarios, creación de borrador por cuenta externa y vista móvil; sin errores JavaScript ni desbordamiento horizontal.
- La suite completa existente tiene 9 pruebas que fallan por dependencias no provistas en sus módulos de prueba. Las nuevas suites pasan; esos fallos no fueron ocultados ni se modificaron sus pruebas para forzarlas a pasar.
- ESLint local no pudo arrancar por ausencia de `eslint-plugin-react-hooks` en la instalación existente.
- Migración comprobada sobre la copia restaurada en PostgreSQL 18 y aplicada en producción el 6 de octubre de 2026.
- API y web publicadas correctamente en Railway el 6 de octubre de 2026. La compilación de Railway completó ESLint y TypeScript, con advertencias previas. Verificados el dashboard existente y la sección Derivaciones → Colegas en la sesión real del administrador.
- Pendiente: transferencias reales a R2 y prueba completa con dos cuentas externas a través de Cloudflare. Las pruebas locales usan repositorios/almacenamiento simulados y no sustituyen esas comprobaciones.
