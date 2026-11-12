# Brújula

Perfil único en este navegador: los borradores de formularios se conservan automáticamente en localStorage y se restauran al navegar o recargar. Se exportan con el resumen y se borran al restablecer el perfil. No hay sincronización entre dispositivos. La preselección en estrategia usa una lista explícita de acciones ordinarias de la tabla original del usuario, ordenadas por el rendimiento histórico de la ventana asociada al horizonte. No equivale a recomendación vigente ni a evaluación de idoneidad. Elegir un símbolo abre el simulador sin inventar entrada ni stop. La gráfica de dona representa capital comprometido, última posición simulada y capital sin asignar; no incluye el fondo de emergencia ni suma el presupuesto de pérdidas como capital.

Gestión de riesgo en Mi estrategia: presupuesto monetario y periodo explícitos, límite por operación, pérdidas realizadas, riesgo abierto, capital comprometido y concentración por nueva posición. Calcula acciones enteras para compras al contado con precios USD y conversión manual. Incluye costos por acción y distingue pérdida estimada al stop de exposición a pérdida total. No ejecuta órdenes ni valida instrumentos automáticamente. Los límites se guardan localmente y se exportan en el resumen. Un cambio de moneda exige volver a confirmar los límites. Pruebas en `tests/risk.test.js`.

Primera versión funcional de diagnóstico y estrategia financiera personal en español. Sin dependencias de instalación.

`npm run dev` abre el servidor local en http://127.0.0.1:4173. `npm test` verifica los cálculos y validaciones.

El chat es una entrevista guiada por reglas, no un modelo de lenguaje. Las respuestas se guardan en localStorage del navegador y pueden editarse, exportarse en JSON o borrarse. No se envían a un servidor. El sitio no incorpora autenticación propia ni sincronización entre dispositivos; el alojamiento Sites conserva su acceso privado.

Los datos de mercado se importaron de los tres CSV proporcionados (26_10_29). No son precios en vivo. Los valores cero o inválidos de precio no se presentan como cotizaciones válidas. No se filtra por pertenencia al S&P 500. El cierre se conserva en USD y no se mezcla con las monedas del diagnóstico.

El diagnóstico calcula ingreso menos gastos menos pagos de deuda. La reserva usa gastos esenciales más pagos de deuda. Los parámetros iniciales (3 meses y revisión del pago de deuda al 30% del ingreso) son supuestos editables, no estándares ni una aprobación para invertir. Se distingue el ahorro líquido del capital adicional. Si hay deudas se solicitan tasas y condiciones antes de priorizarlas. No se asignan instrumentos automáticamente.

Pendiente: IA conversacional con extracción confirmada de datos, servicio R aislado sin efectos de Telegram, actualización de mercado y fecha de observación, clasificación de instrumentos, conciliación de objetivos/stop/dirección y de la fórmula RRR, análisis individual de deudas, persistencia protegida y autenticación por usuario. No se ejecutaron ni publicaron los scripts o credenciales del proyecto stockEX.
