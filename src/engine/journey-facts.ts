/**
 * One short fact per stop, shown when its passport stamp is earned. Spanish at the
 * region's level (A1: present tense, A1 words, ≤ 30 words; B1+: ≤ 45 words), English alongside.
 * Filled in by the content pass; stops without a fact simply show no card text.
 */
export const STOP_FACTS: Record<string, { es: string; en: string }> = {
  // ── A1 · Buenos Aires ──────────────────────────────────────────────────────
  'a1.u01': {
    es: 'El aeropuerto de Ezeiza es el aeropuerto más grande de Argentina. Se llama también Ministro Pistarini. Aquí llegan aviones de todo el mundo. Leo, Bonchita y Luna llegan aquí.',
    en: 'Ezeiza airport is the biggest airport in Argentina. It is also called Ministro Pistarini. Planes from all over the world arrive here. Leo, Bonchita and Luna arrive here.',
  },
  'a1.u02': {
    es: 'San Telmo es un barrio antiguo de Buenos Aires. Tiene calles pequeñas y casas viejas. Los domingos hay un mercado muy grande en la calle Defensa.',
    en: 'San Telmo is an old neighbourhood of Buenos Aires. It has small streets and old houses. On Sundays there is a very big market on Defensa street.',
  },
  'a1.u03': {
    es: 'La Plaza de Mayo es una plaza muy antigua y muy importante. Aquí están la Casa Rosada y la Catedral Metropolitana. La ciudad empieza aquí en 1580.',
    en: 'Plaza de Mayo is a very old and very important square. The Casa Rosada and the Metropolitan Cathedral are here. The city begins here in 1580.',
  },
  'a1.u04': {
    es: 'La Boca es un barrio de Buenos Aires. Tiene casas de muchos colores en la calle Caminito. El equipo de fútbol Boca Juniors es de aquí.',
    en: 'La Boca is a neighbourhood of Buenos Aires. It has houses of many colours on Caminito street. The football team Boca Juniors is from here.',
  },
  'a1.u05': {
    es: 'Puerto Madero es un barrio nuevo y moderno. Está en el puerto antiguo de Buenos Aires. Tiene restaurantes y un puente blanco muy bonito: el Puente de la Mujer.',
    en: 'Puerto Madero is a new, modern neighbourhood. It is in the old port of Buenos Aires. It has restaurants and a very pretty white bridge: the Puente de la Mujer.',
  },
  'a1.u06': {
    es: 'Palermo es el barrio más grande de Buenos Aires. Tiene parques muy grandes, un jardín japonés y muchos bares y restaurantes. Los perros pasean mucho aquí.',
    en: 'Palermo is the biggest neighbourhood of Buenos Aires. It has very big parks, a Japanese garden and many bars and restaurants. Dogs go for lots of walks here.',
  },
  'a1.u07': {
    es: 'Recoleta es un barrio elegante de Buenos Aires. Tiene museos, cafeterías antiguas y una iglesia blanca muy bonita. Mucha gente visita el Cementerio de la Recoleta.',
    en: 'Recoleta is an elegant neighbourhood of Buenos Aires. It has museums, old cafés and a very pretty white church. Many people visit the Recoleta Cemetery.',
  },
  'a1.u08': {
    es: 'La calle Florida es una calle para caminar, sin coches. Está en el centro de Buenos Aires. Tiene muchas tiendas y siempre hay mucha gente.',
    en: 'Florida street is a street for walking, with no cars. It is in the centre of Buenos Aires. It has many shops and there are always lots of people.',
  },
  'a1.u09': {
    es: 'Tigre está a una hora en tren de Buenos Aires. Aquí hay un río muy grande. Mucha gente vive en una isla y va en barco, no en coche.',
    en: 'Tigre is one hour by train from Buenos Aires. Here there is a very big river. Many people live on an island and go by boat, not by car.',
  },
  'a1.u10': {
    es: 'El Barrio Chino está en Belgrano. Tiene restaurantes chinos, supermercados y tiendas. En la entrada hay una puerta china roja muy grande. Cada año celebran el Año Nuevo Chino.',
    en: 'Chinatown is in Belgrano. It has Chinese restaurants, supermarkets and shops. At the entrance there is a very big red Chinese gate. Every year they celebrate Chinese New Year.',
  },
  'a1.u11': {
    es: 'El Teatro Colón es un teatro de música muy grande y muy antiguo. Abre en 1908. Está en el centro de Buenos Aires y es importante en todo el mundo.',
    en: 'The Teatro Colón is a very big and very old music theatre. It opens in 1908. It is in the centre of Buenos Aires and it is important all over the world.',
  },
  'a1.u12': {
    es: 'La Costanera Sur está en el Río de la Plata. Tiene un parque muy grande, la Reserva Ecológica. Mucha gente camina, corre y va en bici aquí.',
    en: 'Costanera Sur is on the Río de la Plata. It has a very big park, the Reserva Ecológica. Many people walk, run and cycle here.',
  },

  // ── A2 · Pampa y Litoral ───────────────────────────────────────────────────
  'a2.u01': {
    es: 'Luján está a unos 70 km de Buenos Aires. Su basílica gótica se terminó en 1935. Cada octubre, más de un millón de personas caminan desde la capital hasta aquí en una peregrinación.',
    en: 'Luján is about 70 km from Buenos Aires. Its Gothic basilica was finished in 1935. Every October, more than a million people walk from the capital to here on a pilgrimage.',
  },
  'a2.u02': {
    es: 'San Antonio de Areco es el pueblo de los gauchos. Aquí vivió Ricardo Güiraldes, autor de "Don Segundo Sombra". En noviembre celebra la Fiesta de la Tradición, una de las más antiguas del país.',
    en: 'San Antonio de Areco is the town of the gauchos. Ricardo Güiraldes, author of "Don Segundo Sombra", lived here. In November it celebrates the Fiesta de la Tradición, one of the oldest in the country.',
  },
  'a2.u03': {
    es: 'Rosario está a orillas del río Paraná. Aquí nació Lionel Messi y aquí Belgrano creó la bandera argentina en 1812. El Monumento a la Bandera, inaugurado en 1957, tiene 70 metros de altura.',
    en: 'Rosario is on the banks of the Paraná river. Lionel Messi was born here, and here Belgrano created the Argentine flag in 1812. The Monumento a la Bandera, opened in 1957, is 70 metres tall.',
  },
  'a2.u04': {
    es: 'Santa Fe fue fundada en 1573 y aquí se firmó la Constitución argentina de 1853. Es famosa por su cerveza y por el "liso", un vaso pequeño de cerveza muy fría.',
    en: 'Santa Fe was founded in 1573, and the Argentine Constitution of 1853 was signed here. It is famous for its beer and for the "liso", a small glass of very cold beer.',
  },
  'a2.u05': {
    es: 'Paraná, la capital de Entre Ríos, fue la capital de la Confederación Argentina entre 1854 y 1861. Un túnel debajo del río Paraná, abierto en 1969, une la ciudad con Santa Fe.',
    en: 'Paraná, the capital of Entre Ríos, was the capital of the Argentine Confederation between 1854 and 1861. A tunnel under the Paraná river, opened in 1969, links the city with Santa Fe.',
  },
  'a2.u06': {
    es: 'Colón está a orillas del río Uruguay, frente a Paysandú. Tiene playas de arena y aguas termales. A unos 50 km está el Parque Nacional El Palmar, con palmeras yatay de cientos de años.',
    en: 'Colón is on the banks of the Uruguay river, opposite Paysandú. It has sandy beaches and hot springs. About 50 km away is El Palmar National Park, with yatay palms hundreds of years old.',
  },
  'a2.u07': {
    es: 'Gualeguaychú es famosa por su carnaval, uno de los más grandes de Argentina. Cada verano, de enero a marzo, las comparsas desfilan los sábados en el Corsódromo con trajes de plumas y carrozas enormes.',
    en: 'Gualeguaychú is famous for its carnival, one of the biggest in Argentina. Every summer, from January to March, the troupes parade on Saturdays in the Corsódromo with feathered costumes and enormous floats.',
  },
  'a2.u08': {
    es: 'Corrientes fue fundada en 1588 a orillas del río Paraná. Es la tierra del chamamé, una música alegre que se baila en pareja, y cada enero celebra la Fiesta Nacional del Chamamé.',
    en: 'Corrientes was founded in 1588 on the banks of the Paraná river. It is the land of chamamé, a cheerful music danced in couples, and every January it celebrates the Fiesta Nacional del Chamamé.',
  },
  'a2.u09': {
    es: 'Resistencia, la capital del Chaco, se llama "la ciudad de las esculturas". Tiene más de 600 esculturas en sus calles y plazas, y cada dos años organiza una Bienal de escultores al aire libre.',
    en: 'Resistencia, the capital of Chaco, is called "the city of sculptures". It has more than 600 sculptures in its streets and squares, and every two years it holds an open-air sculptors\' Biennial.',
  },
  'a2.u10': {
    es: 'Las Cataratas del Iguazú tienen unos 275 saltos de agua entre Argentina y Brasil. El más alto es la Garganta del Diablo, de más de 80 metros. Son Patrimonio de la Humanidad desde 1984.',
    en: 'The Iguazú Falls have about 275 waterfalls between Argentina and Brazil. The tallest is the Garganta del Diablo, more than 80 metres high. They have been a World Heritage Site since 1984.',
  },
  'a2.u11': {
    es: 'Posadas es la capital de Misiones y está frente a Encarnación, en Paraguay. Un puente de más de dos kilómetros une las dos ciudades sobre el río Paraná. Aquí la gente toma tereré, mate frío.',
    en: 'Posadas is the capital of Misiones and sits opposite Encarnación, in Paraguay. A bridge more than two kilometres long links the two cities over the Paraná river. Here people drink tereré, cold mate.',
  },
  'a2.u12': {
    es: 'San Ignacio Miní fue una misión jesuita fundada en 1610 y trasladada aquí en 1696. Sus ruinas de piedra roja, muy bien conservadas, son Patrimonio de la Humanidad desde 1984.',
    en: 'San Ignacio Miní was a Jesuit mission founded in 1610 and moved here in 1696. Its red stone ruins, very well preserved, have been a World Heritage Site since 1984.',
  },

  // ── B1 · El Norte ──────────────────────────────────────────────────────────
  'b1.u01': {
    es: 'Córdoba es la segunda ciudad más poblada de Argentina y tiene la universidad más antigua del país, fundada por los jesuitas en 1613. La Manzana Jesuítica, en pleno centro, es Patrimonio de la Humanidad desde el año 2000.',
    en: 'Córdoba is the second most populous city in Argentina and has the oldest university in the country, founded by the Jesuits in 1613. The Jesuit Block, right in the centre, has been a World Heritage Site since the year 2000.',
  },
  'b1.u02': {
    es: 'En Alta Gracia pasó parte de su infancia Ernesto "Che" Guevara, cuya familia se mudó aquí por su asma; hoy su casa es un museo. El pueblo también conserva una estancia jesuítica del siglo XVII y la casa del compositor Manuel de Falla.',
    en: 'Ernesto "Che" Guevara spent part of his childhood in Alta Gracia, where his family moved because of his asthma; today his house is a museum. The town also preserves a 17th-century Jesuit estancia and the house of the composer Manuel de Falla.',
  },
  'b1.u03': {
    es: 'Villa General Belgrano fue fundada en 1932 por inmigrantes alemanes, y después se sumaron marineros del acorazado Graf Spee, hundido en 1939. Cada octubre el pueblo celebra la Fiesta Nacional de la Cerveza, el Oktoberfest argentino, con desfiles y música.',
    en: 'Villa General Belgrano was founded in 1932 by German immigrants, later joined by sailors from the battleship Graf Spee, sunk in 1939. Every October the town celebrates the Fiesta Nacional de la Cerveza, the Argentine Oktoberfest, with parades and music.',
  },
  'b1.u04': {
    es: 'Santiago del Estero, fundada en 1553, es la ciudad más antigua de Argentina que todavía existe; por eso se la llama "Madre de Ciudades". Es la cuna de la chacarera, un baile folclórico que se toca con bombo, guitarra y violín.',
    en: 'Santiago del Estero, founded in 1553, is the oldest city in Argentina that still exists, which is why it is called the "Mother of Cities". It is the cradle of the chacarera, a folk dance played with bombo drum, guitar and violin.',
  },
  'b1.u05': {
    es: 'San Miguel de Tucumán es la capital de la provincia más pequeña del país. En la Casa Histórica, el 9 de julio de 1816, se declaró la independencia argentina. La provincia se conoce como "el Jardín de la República" por sus cañaverales y cerros verdes.',
    en: 'San Miguel de Tucumán is the capital of the smallest province in the country. In the Casa Histórica, on 9 July 1816, Argentine independence was declared. The province is known as "the Garden of the Republic" for its sugar-cane fields and green hills.',
  },
  'b1.u06': {
    es: 'Tafí del Valle es un valle a unos 2.000 metros de altura, entre montañas, en el camino hacia los Valles Calchaquíes. Es famoso por sus quesos, que se elaboran desde la época de los jesuitas, y cada febrero celebra la Fiesta Nacional del Queso.',
    en: 'Tafí del Valle is a valley about 2,000 metres high, between mountains, on the way to the Calchaquí Valleys. It is famous for its cheeses, made since the time of the Jesuits, and every February it celebrates the Fiesta Nacional del Queso.',
  },
  'b1.u07': {
    es: 'Cafayate está en los Valles Calchaquíes, a más de 1.600 metros de altura. Sus viñedos, entre los más altos del mundo, producen el torrontés, un vino blanco aromático típico de Argentina. Leo, Bonchita y Luna prefieren las empanadas salteñas.',
    en: 'Cafayate is in the Calchaquí Valleys, more than 1,600 metres above sea level. Its vineyards, among the highest in the world, produce torrontés, an aromatic white wine typical of Argentina. Leo, Bonchita and Luna prefer the Salta-style empanadas.',
  },
  'b1.u08': {
    es: 'Salta se conoce como "la Linda" por su arquitectura colonial. Su catedral rosada y la iglesia de San Francisco, con una torre de más de 50 metros, están junto a la Plaza 9 de Julio. Desde aquí se toma el Tren a las Nubes.',
    en: 'Salta is known as "la Linda" (the Beautiful) for its colonial architecture. Its pink cathedral and the church of San Francisco, with a tower more than 50 metres tall, stand by Plaza 9 de Julio. From here you take the Train to the Clouds.',
  },
  'b1.u09': {
    es: 'Purmamarca es un pueblo pequeño de la Quebrada de Humahuaca, al pie del Cerro de los Siete Colores. Sus capas de distintos minerales se formaron durante millones de años. En la plaza hay una feria de artesanías y una iglesia de adobe del siglo XVII.',
    en: 'Purmamarca is a small village in the Quebrada de Humahuaca, at the foot of the Hill of Seven Colours. Its layers of different minerals formed over millions of years. In the square there is a crafts market and a 17th-century adobe church.',
  },
  'b1.u10': {
    es: 'Tilcara es el centro turístico de la Quebrada de Humahuaca, declarada Patrimonio de la Humanidad en 2003. Sobre una colina está el Pucará, una antigua fortaleza prehispánica reconstruida en parte en el siglo XX, desde donde se ve todo el valle.',
    en: 'Tilcara is the tourist hub of the Quebrada de Humahuaca, declared a World Heritage Site in 2003. On a hill stands the Pucará, an ancient pre-Hispanic fortress partly rebuilt in the 20th century, from where you can see the whole valley.',
  },
  'b1.u11': {
    es: 'San Salvador de Jujuy, fundada en 1593, es la capital provincial más al norte del país. En agosto de 1812 el general Belgrano ordenó el Éxodo Jujeño: toda la población abandonó la ciudad para no caer en manos del ejército realista.',
    en: 'San Salvador de Jujuy, founded in 1593, is the northernmost provincial capital in the country. In August 1812 General Belgrano ordered the Jujuy Exodus: the whole population left the city so as not to fall into the hands of the royalist army.',
  },
  'b1.u12': {
    es: 'Las Salinas Grandes son un enorme desierto de sal a unos 3.450 metros de altura, entre Jujuy y Salta. Ocupan más de 200 km² y se formaron al evaporarse un antiguo lago. Cuando llueve, el agua convierte la superficie en un espejo gigante.',
    en: 'The Salinas Grandes are an enormous salt desert about 3,450 metres above sea level, between Jujuy and Salta. They cover more than 200 km² and formed when an ancient lake evaporated. When it rains, the water turns the surface into a giant mirror.',
  },

  // ── B2 · Cuyo ──────────────────────────────────────────────────────────────
  'b2.u01': {
    es: 'San Juan, fundada en 1562, quedó casi destruida por un terremoto en 1944; la ciudad que vemos hoy se reconstruyó con calles anchas y edificios bajos. Aquí nació Domingo Faustino Sarmiento, presidente y educador, cuya casa natal es hoy un museo nacional.',
    en: 'San Juan, founded in 1562, was almost destroyed by an earthquake in 1944; the city we see today was rebuilt with wide streets and low buildings. Domingo Faustino Sarmiento, president and educator, was born here, and his birthplace is now a national museum.',
  },
  'b2.u02': {
    es: 'Ischigualasto, conocido como Valle de la Luna, es uno de los pocos lugares del mundo donde está expuesto casi todo el período Triásico. Allí se encontraron fósiles de algunos de los dinosaurios más antiguos, como el Eoraptor, de hace unos 230 millones de años.',
    en: 'Ischigualasto, known as the Valley of the Moon, is one of the few places in the world where almost the entire Triassic period is exposed. Fossils of some of the oldest dinosaurs were found there, such as Eoraptor, from about 230 million years ago.',
  },
  'b2.u03': {
    es: 'Mendoza es la capital del vino argentino: a su alrededor se produce la mayor parte del malbec. Aunque está en una zona desértica, sus calles arboladas se riegan con acequias, un sistema de canales que ya usaban los huarpes antes de que llegaran los españoles.',
    en: 'Mendoza is the capital of Argentine wine: most of the malbec is produced around it. Although it lies in a desert area, its tree-lined streets are watered by acequias, a system of channels that the Huarpe people were already using before the Spanish arrived.',
  },
  'b2.u04': {
    es: 'Maipú, a pocos kilómetros de Mendoza, es una de las zonas vitivinícolas más antiguas de la provincia. Muchos visitantes recorren sus bodegas en bicicleta y prueban también el aceite de oliva, que aquí se elabora desde hace más de un siglo. Bonchita prefiere el queso.',
    en: 'Maipú, a few kilometres from Mendoza, is one of the oldest wine-growing areas in the province. Many visitors tour its wineries by bicycle and also try the olive oil, which has been made here for more than a century. Bonchita prefers the cheese.',
  },
  'b2.u05': {
    es: 'El Aconcagua, con 6.961 metros, es la montaña más alta de América y la más alta del mundo fuera de Asia. Aunque la ruta normal no exige escalada técnica, la altura y el viento obligan a muchos montañistas a darse la vuelta cada temporada.',
    en: 'Aconcagua, at 6,961 metres, is the highest mountain in the Americas and the highest in the world outside Asia. Although the normal route requires no technical climbing, the altitude and the wind force many climbers to turn back every season.',
  },
  'b2.u06': {
    es: 'El Puente del Inca es un puente natural de piedra sobre el río Las Cuevas, teñido de amarillo y naranja por los minerales de las aguas termales que brotan debajo. A su lado quedan las ruinas de un hotel arrasado por una avalancha en 1965.',
    en: 'The Puente del Inca is a natural stone bridge over the Las Cuevas river, stained yellow and orange by the minerals of the hot springs that flow beneath it. Beside it lie the ruins of a hotel swept away by an avalanche in 1965.',
  },
  'b2.u07': {
    es: 'Malargüe, al sur de Mendoza, es la puerta de entrada a Las Leñas, uno de los centros de esquí más importantes del país. Cerca, el Observatorio Pierre Auger, el mayor del mundo en su tipo, estudia los rayos cósmicos con detectores repartidos en 3.000 km².',
    en: 'Malargüe, in the south of Mendoza, is the gateway to Las Leñas, one of the most important ski resorts in the country. Nearby, the Pierre Auger Observatory, the largest of its kind in the world, studies cosmic rays with detectors spread over 3,000 km².',
  },
  'b2.u08': {
    es: 'San Rafael es la segunda ciudad de Mendoza y una importante zona de viñedos y frutales, regada por los ríos Diamante y Atuel. Nació en 1805 como un fuerte de frontera, y hoy recibe a quienes buscan bodegas, rafting y paseos por el campo.',
    en: 'San Rafael is the second city of Mendoza and an important area of vineyards and orchards, irrigated by the Diamante and Atuel rivers. It began in 1805 as a frontier fort, and today it welcomes those looking for wineries, rafting and countryside walks.',
  },
  'b2.u09': {
    es: 'El Cañón del Atuel, entre San Rafael y el embalse El Nihuil, es una garganta de unos 50 km excavada por el río en rocas rojizas, ocres y grises. El viento y el agua esculpieron formas con nombres populares como "el Lagarto" o "los Monstruos".',
    en: 'The Atuel Canyon, between San Rafael and the El Nihuil reservoir, is a gorge of about 50 km carved by the river through reddish, ochre and grey rock. Wind and water sculpted shapes with popular names such as "the Lizard" or "the Monsters".',
  },
  'b2.u10': {
    es: 'San Luis fue fundada en 1594. Sus habitantes se llaman "puntanos" porque la ciudad se conocía como San Luis de la Punta de los Venados, por estar en el extremo sur de las sierras. La provincia atrae turistas con sus diques, ríos y sierras.',
    en: 'San Luis was founded in 1594. Its inhabitants are called "puntanos" because the city was known as San Luis de la Punta de los Venados, as it lay at the southern tip of the hills. The province attracts tourists with its reservoirs, rivers and hills.',
  },
  'b2.u11': {
    es: 'Villa de Merlo, en las sierras de los Comechingones, presume de un microclima suave y seco que atrae a jubilados y turistas. Cerca está el Algarrobo Abuelo, un árbol de varios siglos bajo el cual, dicen, escribía el poeta Antonio Esteban Agüero.',
    en: 'Villa de Merlo, in the Comechingones hills, boasts a mild, dry microclimate that attracts retirees and tourists. Nearby stands the Algarrobo Abuelo, a tree several centuries old under which, they say, the poet Antonio Esteban Agüero used to write.',
  },
  'b2.u12': {
    es: 'El Parque Nacional Talampaya, en La Rioja, protege un cañón de paredes rojas de más de 100 metros, moldeadas por el agua y el viento durante millones de años. Con Ischigualasto forma un sitio Patrimonio de la Humanidad desde 2000, con fósiles y petroglifos.',
    en: 'Talampaya National Park, in La Rioja, protects a canyon of red walls more than 100 metres high, shaped by water and wind over millions of years. With Ischigualasto it has formed a World Heritage Site since 2000, with fossils and petroglyphs.',
  },

  // ── C1 · Patagonia ─────────────────────────────────────────────────────────
  'c1.u01': {
    es: 'Neuquén, en la confluencia de los ríos Limay y Neuquén, es la ciudad más poblada de la Patagonia argentina. Creció gracias al petróleo y al gas de Vaca Muerta, y en la provincia se hallaron algunos de los dinosaurios más grandes conocidos, como el Argentinosaurus.',
    en: 'Neuquén, at the confluence of the Limay and Neuquén rivers, is the most populous city in Argentine Patagonia. It grew thanks to the oil and gas of Vaca Muerta, and some of the largest known dinosaurs, such as Argentinosaurus, were found in the province.',
  },
  'c1.u02': {
    es: 'Villa La Angostura se asienta a orillas del lago Nahuel Huapi, rodeada de bosques y montañas. Desde su puerto salen las excursiones al Bosque de Arrayanes, árboles de corteza color canela y fría al tacto que, según se cuenta, inspiraron la película "Bambi".',
    en: 'Villa La Angostura sits on the shores of Lake Nahuel Huapi, surrounded by forests and mountains. From its harbour, boat trips leave for the Arrayanes Forest, trees with cinnamon-coloured bark that is cold to the touch and which, so the story goes, inspired the film "Bambi".',
  },
  'c1.u03': {
    es: 'Bariloche, fundada en 1902 por colonos de origen alemán, es la ciudad más grande de la Patagonia andina. Su centro cívico de piedra y madera recuerda a los Alpes, y es célebre por el chocolate artesanal y el Cerro Catedral, su gran centro de esquí.',
    en: 'Bariloche, founded in 1902 by settlers of German origin, is the largest city in Andean Patagonia. Its civic centre of stone and wood recalls the Alps, and it is famous for its handmade chocolate and Cerro Catedral, its great ski resort.',
  },
  'c1.u04': {
    es: 'El Bolsón, en un valle protegido entre montañas, tiene un clima más suave que el resto de la Patagonia y cultiva frutas finas, lúpulo y hortalizas. Desde los años setenta atrae a comunidades hippies y artesanos, y en 1984 se declaró "municipio no nuclear".',
    en: 'El Bolsón, in a sheltered valley between mountains, has a milder climate than the rest of Patagonia and grows berries, hops and vegetables. Since the seventies it has attracted hippie communities and craftspeople, and in 1984 it declared itself a "non-nuclear municipality".',
  },
  'c1.u05': {
    es: 'De Esquel sale La Trochita, el Viejo Expreso Patagónico: un tren a vapor de trocha angosta, de solo 75 centímetros, que llegó a Esquel en 1945. Paul Theroux lo hizo famoso en su libro de viajes, y hoy recorre un tramo turístico hasta Nahuel Pan.',
    en: 'From Esquel departs La Trochita, the Old Patagonian Express: a narrow-gauge steam train, just 75 centimetres wide, which reached Esquel in 1945. Paul Theroux made it famous in his travel book, and today it runs a tourist stretch to Nahuel Pan.',
  },
  'c1.u06': {
    es: 'Puerto Madryn fue fundada en 1865 por colonos galeses llegados en el velero Mimosa, y algunos pueblos cercanos conservan la lengua y las casas de té galesas. Entre junio y diciembre, las ballenas francas se acercan a la costa y se ven desde la playa.',
    en: 'Puerto Madryn was founded in 1865 by Welsh settlers who arrived on the sailing ship Mimosa, and some nearby towns keep the Welsh language and Welsh tea houses. Between June and December, southern right whales come close to the coast and can be seen from the beach.',
  },
  'c1.u07': {
    es: 'La Península Valdés, Patrimonio de la Humanidad desde 1999, es uno de los grandes santuarios de fauna marina del planeta: ballenas, elefantes y lobos marinos, pingüinos y orcas. En Punta Norte, las orcas varan a propósito en la playa para cazar crías de lobo marino.',
    en: "Península Valdés, a World Heritage Site since 1999, is one of the planet's great sanctuaries of marine wildlife: whales, elephant seals and sea lions, penguins and orcas. At Punta Norte, the orcas deliberately strand themselves on the beach to hunt sea lion pups.",
  },
  'c1.u08': {
    es: 'Trelew, cuyo nombre significa "pueblo de Lewis" en galés, nació en 1886 como estación del ferrocarril que unía el valle del Chubut con el puerto. Hoy alberga el Museo Paleontológico Egidio Feruglio, donde se exhibe el Patagotitan, uno de los dinosaurios más grandes conocidos.',
    en: "Trelew, whose name means \"Lewis's town\" in Welsh, was born in 1886 as a station on the railway linking the Chubut valley with the port. Today it houses the Egidio Feruglio Palaeontological Museum, where Patagotitan, one of the largest known dinosaurs, is on display.",
  },
  'c1.u09': {
    es: 'Los Antiguos, a orillas del lago Buenos Aires y a pocos kilómetros de Chile, es la Capital Nacional de la Cereza: su microclima permite cosechar cerezas y frutillas en enero. En 1991 la ceniza del volcán Hudson cubrió el pueblo, pero sus chacras se recuperaron.',
    en: 'Los Antiguos, on the shores of Lake Buenos Aires and a few kilometres from Chile, is the National Cherry Capital: its microclimate allows cherries and strawberries to be harvested in January. In 1991 ash from the Hudson volcano covered the town, but its farms recovered.',
  },
  'c1.u10': {
    es: 'El Chaltén, fundado en 1985 para afirmar la soberanía argentina en la frontera, es la Capital Nacional del Trekking. Está al pie del cerro Fitz Roy, cuya cumbre de granito, de 3.405 metros, suele esconderse entre nubes; los tehuelches lo llamaban "montaña que humea".',
    en: 'El Chaltén, founded in 1985 to assert Argentine sovereignty on the border, is the National Trekking Capital. It stands at the foot of Mount Fitz Roy, whose granite summit, 3,405 metres high, is often hidden in clouds; the Tehuelche people called it "smoking mountain".',
  },

  // ── C2 · Fin del mundo ─────────────────────────────────────────────────────
  'c2.u01': {
    es: 'Desde El Calafate se visita el glaciar Perito Moreno, un frente de hielo de unos 5 km de ancho y 60 metros sobre el lago Argentino. Casi no retrocede, algo poco común hoy, y cada pocos años forma un dique que se rompe con estruendo.',
    en: 'From El Calafate you visit the Perito Moreno glacier, an ice front about 5 km wide and 60 metres above Lake Argentino. It barely retreats, something uncommon today, and every few years it forms a dam that bursts with a roar.',
  },
  'c2.u02': {
    es: 'Río Gallegos, capital de Santa Cruz, se extiende sobre el estuario del río del mismo nombre, donde las mareas están entre las más amplias del mundo: hasta 12 o 13 metros. Ciudad de viento constante y ovejas, fue el centro de las grandes estancias laneras.',
    en: 'Río Gallegos, capital of Santa Cruz, spreads along the estuary of the river of the same name, where the tides are among the widest in the world: up to 12 or 13 metres. A city of constant wind and sheep, it was the centre of the great wool estancias.',
  },
  'c2.u03': {
    es: 'Ushuaia, entre los montes Martial y el canal Beagle, se presenta como la ciudad más austral del mundo, aunque la chilena Puerto Williams le disputa el título. Nació en 1884 junto a una misión anglicana y creció alrededor de un presidio que funcionó hasta 1947.',
    en: 'Ushuaia, between the Martial mountains and the Beagle Channel, presents itself as the southernmost city in the world, although Chilean Puerto Williams disputes the title. It was born in 1884 beside an Anglican mission and grew around a prison that operated until 1947.',
  },
  'c2.u04': {
    es: 'El Tren del Fin del Mundo sigue el trazado del antiguo "tren de los presos", con el que los reclusos del presidio iban cada día a cortar leña al bosque. Una locomotora a vapor lleva a los visitantes hasta el Parque Nacional Tierra del Fuego.',
    en: "The End of the World Train follows the route of the old \"prisoners' train\", on which the inmates of the prison went every day to cut firewood in the forest. A steam locomotive carries visitors to Tierra del Fuego National Park.",
  },
  'c2.u05': {
    es: 'El canal Beagle debe su nombre al HMS Beagle, el barco en el que Charles Darwin recorrió estas aguas en 1833. Separa la isla Grande de Tierra del Fuego de la isla Navarino, y por su centro pasa la frontera entre Argentina y Chile.',
    en: 'The Beagle Channel owes its name to HMS Beagle, the ship on which Charles Darwin sailed these waters in 1833. It separates the main island of Tierra del Fuego from Navarino Island, and the border between Argentina and Chile runs down its middle.',
  },
  'c2.u06': {
    es: 'La isla Martillo, en el canal Beagle, acoge cada primavera y verano miles de pingüinos de Magallanes y algunas parejas de pingüinos papúa, muy raros en Sudamérica. Las visitas se hacen en silencio y en grupos pequeños; Luna los mira sin ladrar.',
    en: 'Martillo Island, in the Beagle Channel, hosts every spring and summer thousands of Magellanic penguins and a few pairs of gentoo penguins, very rare in South America. Visits are made in silence and in small groups; Luna watches them without barking.',
  },
  'c2.u07': {
    es: 'Desde Ushuaia, a unos 1.000 km de la península antártica, zarpan la mayoría de los cruceros a la Antártida. Argentina tiene presencia permanente allí desde 1904, cuando se hizo cargo de la base de las islas Orcadas del Sur, la más antigua de la Antártida.',
    en: 'From Ushuaia, about 1,000 km from the Antarctic Peninsula, most cruises to Antarctica set sail. Argentina has had a permanent presence there since 1904, when it took over the base on the South Orkney Islands, the oldest in Antarctica.',
  },
  'c2.u08': {
    es: 'El viaje termina donde empezó. Argentina es el octavo país más grande del mundo: unos 3.700 km separan La Quiaca de Ushuaia, con selvas, salares, viñedos, estepas y glaciares en el camino. Leo, Bonchita y Luna vuelven a casa con el pasaporte lleno de sellos.',
    en: 'The journey ends where it began. Argentina is the eighth-largest country in the world: some 3,700 km separate La Quiaca from Ushuaia, with jungles, salt flats, vineyards, steppes and glaciers along the way. Leo, Bonchita and Luna return home with their passport full of stamps.',
  },
}
