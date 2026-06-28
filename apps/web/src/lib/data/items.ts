// Static MCU catalog consumed by Astro pages, filters, stats, and progress UI.
// No dependencies on other files.

import type { Item } from '$lib/domain/item';

export const items: Item[] = [
	{
		id: 'eyes-of-wakanda',
		title: 'Eyes of Wakanda',
		timeline: '1260 BC, 1200 BC, 1400 and 1896',
		era: 'Ancient history',
		dot: 'BC',
		type: 'series',
		imdbId: 'tt13968252',
		essential: false
	},
	{
		id: 'captain-america-the-first-avenger',
		title: 'Captain America: The First Avenger',
		timeline: '1943-1945',
		era: '1940s',
		dot: '1943',
		type: 'movie',
		runtimeMinutes: 124,
		imdbId: 'tt0458339',
		essential: true
	},
	{
		id: 'agent-carter',
		title: 'Agent Carter',
		timeline: '1946',
		era: '1940s',
		dot: '1946',
		type: 'series',
		imdbId: 'tt3475734',
		essential: false
	},
	{
		id: 'captain-marvel',
		title: 'Captain Marvel',
		timeline: '1995',
		era: '1990s',
		dot: '1995',
		type: 'movie',
		runtimeMinutes: 124,
		imdbId: 'tt4154664',
		essential: true
	},
	{
		id: 'iron-man',
		title: 'Iron Man',
		timeline: '2008',
		era: '2008-2012',
		dot: '2008',
		type: 'movie',
		runtimeMinutes: 126,
		imdbId: 'tt0371746',
		essential: true
	},
	{
		id: 'iron-man-2',
		title: 'Iron Man 2',
		timeline: '2010',
		era: '2008-2012',
		dot: '2010',
		type: 'movie',
		runtimeMinutes: 124,
		imdbId: 'tt1228705',
		essential: true
	},
	{
		id: 'the-incredible-hulk',
		title: 'The Incredible Hulk',
		timeline: '2010',
		era: '2008-2012',
		dot: '2010',
		type: 'movie',
		runtimeMinutes: 114,
		imdbId: 'tt0800080',
		essential: false
	},
	{
		id: 'a-funny-thing-happened-on-the-way-to-thors-hammer',
		title: "A Funny Thing Happened on the Way to Thor's Hammer",
		timeline: '2010',
		era: '2008-2012',
		dot: '2010',
		type: 'short',
		imdbId: 'tt2011109',
		essential: false
	},
	{
		id: 'thor',
		title: 'Thor',
		timeline: '2010',
		era: '2008-2012',
		dot: '2010',
		type: 'movie',
		runtimeMinutes: 114,
		imdbId: 'tt0800369',
		essential: true
	},
	{
		id: 'the-consultant',
		title: 'The Consultant',
		timeline: '2010',
		era: '2008-2012',
		dot: '2010',
		type: 'short',
		imdbId: 'tt2011118',
		essential: false
	},
	{
		id: 'the-avengers',
		title: 'The Avengers',
		timeline: '2012',
		era: '2008-2012',
		dot: '2012',
		type: 'movie',
		runtimeMinutes: 143,
		imdbId: 'tt0848228',
		essential: true
	},
	{
		id: 'item-47',
		title: 'Item 47',
		timeline: '2012',
		era: '2008-2012',
		dot: '2012',
		type: 'short',
		imdbId: 'tt2247732',
		essential: false
	},
	{
		id: 'thor-the-dark-world',
		title: 'Thor: The Dark World',
		timeline: '2013',
		era: '2013-2015',
		dot: '2013',
		type: 'movie',
		runtimeMinutes: 112,
		imdbId: 'tt1981115',
		essential: false
	},
	{
		id: 'iron-man-3',
		title: 'Iron Man 3',
		timeline: '2013',
		era: '2013-2015',
		dot: '2013',
		type: 'movie',
		runtimeMinutes: 130,
		imdbId: 'tt1300854',
		essential: true
	},
	{
		id: 'all-hail-the-king',
		title: 'All Hail the King',
		timeline: '2014',
		era: '2013-2015',
		dot: '2014',
		type: 'short',
		imdbId: 'tt3438640',
		essential: false
	},
	{
		id: 'captain-america-the-winter-soldier',
		title: 'Captain America: The Winter Soldier',
		timeline: '2014',
		era: '2013-2015',
		dot: '2014',
		type: 'movie',
		runtimeMinutes: 136,
		imdbId: 'tt1843866',
		essential: true
	},
	{
		id: 'guardians-of-the-galaxy',
		title: 'Guardians of the Galaxy',
		timeline: '2014',
		era: '2013-2015',
		dot: '2014',
		type: 'movie',
		runtimeMinutes: 121,
		imdbId: 'tt2015381',
		essential: true
	},
	{
		id: 'guardians-of-the-galaxy-vol-2',
		title: 'Guardians of the Galaxy Vol. 2',
		timeline: '2014',
		era: '2013-2015',
		dot: '2014',
		type: 'movie',
		runtimeMinutes: 136,
		imdbId: 'tt3896198',
		essential: true
	},
	{
		id: 'i-am-groot-season-1',
		title: 'I Am Groot season 1',
		timeline: '2014',
		era: '2013-2015',
		dot: '2014',
		type: 'series',
		imdbId: 'tt13623148',
		essential: false
	},
	{
		id: 'i-am-groot-season-2',
		title: 'I Am Groot season 2',
		timeline: '2014',
		era: '2013-2015',
		dot: '2014',
		type: 'series',
		imdbId: 'tt13623148',
		essential: false
	},
	{
		id: 'daredevil-season-1',
		title: 'Daredevil season 1',
		timeline: '2015',
		era: '2013-2015',
		dot: '2015',
		type: 'series',
		imdbId: 'tt3322312',
		essential: false
	},
	{
		id: 'jessica-jones-season-1',
		title: 'Jessica Jones season 1',
		timeline: '2015',
		era: '2013-2015',
		dot: '2015',
		type: 'series',
		imdbId: 'tt2357547',
		essential: false
	},
	{
		id: 'avengers-age-of-ultron',
		title: 'Avengers: Age of Ultron',
		timeline: '2015',
		era: '2013-2015',
		dot: '2015',
		type: 'movie',
		runtimeMinutes: 141,
		imdbId: 'tt2395427',
		essential: true
	},
	{
		id: 'ant-man',
		title: 'Ant-Man',
		timeline: '2015',
		era: '2013-2015',
		dot: '2015',
		type: 'movie',
		runtimeMinutes: 117,
		imdbId: 'tt0478970',
		essential: true
	},
	{
		id: 'daredevil-season-2',
		title: 'Daredevil season 2',
		timeline: '2015',
		era: '2013-2015',
		dot: '2015',
		type: 'series',
		imdbId: 'tt3322312',
		essential: false
	},
	{
		id: 'luke-cage-season-1',
		title: 'Luke Cage season 1',
		timeline: '2015',
		era: '2013-2015',
		dot: '2015',
		type: 'series',
		imdbId: 'tt3322314',
		essential: false
	},
	{
		id: 'iron-fist-season-1',
		title: 'Iron Fist season 1',
		timeline: '2016',
		era: '2016-2018',
		dot: '2016',
		type: 'series',
		imdbId: 'tt3322310',
		essential: false
	},
	{
		id: 'the-defenders',
		title: 'The Defenders',
		timeline: '2016',
		era: '2016-2018',
		dot: '2016',
		type: 'series',
		imdbId: 'tt4230076',
		essential: false
	},
	{
		id: 'captain-america-civil-war',
		title: 'Captain America: Civil War',
		timeline: '2016',
		era: '2016-2018',
		dot: '2016',
		type: 'movie',
		runtimeMinutes: 147,
		imdbId: 'tt3498820',
		essential: true
	},
	{
		id: 'black-widow',
		title: 'Black Widow',
		timeline: '2016',
		era: '2016-2018',
		dot: '2016',
		type: 'movie',
		runtimeMinutes: 134,
		imdbId: 'tt3480822',
		essential: true
	},
	{
		id: 'black-panther',
		title: 'Black Panther',
		timeline: '2016',
		era: '2016-2018',
		dot: '2016',
		type: 'movie',
		runtimeMinutes: 134,
		imdbId: 'tt1825683',
		essential: true
	},
	{
		id: 'spider-man-homecoming',
		title: 'Spider-Man: Homecoming',
		timeline: '2016',
		era: '2016-2018',
		dot: '2016',
		type: 'movie',
		runtimeMinutes: 133,
		imdbId: 'tt2250912',
		essential: true
	},
	{
		id: 'the-punisher-season-1',
		title: 'The Punisher season 1',
		timeline: '2016',
		era: '2016-2018',
		dot: '2016',
		type: 'series',
		imdbId: 'tt5675620',
		essential: false
	},
	{
		id: 'doctor-strange',
		title: 'Doctor Strange',
		timeline: '2016-2017',
		era: '2016-2018',
		dot: '2016',
		type: 'movie',
		runtimeMinutes: 115,
		imdbId: 'tt1211837',
		essential: true
	},
	{
		id: 'jessica-jones-season-2',
		title: 'Jessica Jones season 2',
		timeline: '2017',
		era: '2016-2018',
		dot: '2017',
		type: 'series',
		imdbId: 'tt2357547',
		essential: false
	},
	{
		id: 'luke-cage-season-2',
		title: 'Luke Cage season 2',
		timeline: '2017',
		era: '2016-2018',
		dot: '2017',
		type: 'series',
		imdbId: 'tt3322314',
		essential: false
	},
	{
		id: 'iron-fist-season-2',
		title: 'Iron Fist season 2',
		timeline: '2017',
		era: '2016-2018',
		dot: '2017',
		type: 'series',
		imdbId: 'tt3322310',
		essential: false
	},
	{
		id: 'daredevil-season-3',
		title: 'Daredevil season 3',
		timeline: '2017',
		era: '2016-2018',
		dot: '2017',
		type: 'series',
		imdbId: 'tt3322312',
		essential: false
	},
	{
		id: 'thor-ragnarok',
		title: 'Thor: Ragnarok',
		timeline: '2017',
		era: '2016-2018',
		dot: '2017',
		type: 'movie',
		runtimeMinutes: 130,
		imdbId: 'tt3501632',
		essential: true
	},
	{
		id: 'the-punisher-season-2',
		title: 'The Punisher season 2',
		timeline: '2018',
		era: '2016-2018',
		dot: '2018',
		type: 'series',
		imdbId: 'tt5675620',
		essential: false
	},
	{
		id: 'jessica-jones-season-3',
		title: 'Jessica Jones season 3',
		timeline: '2018',
		era: '2016-2018',
		dot: '2018',
		type: 'series',
		imdbId: 'tt2357547',
		essential: false
	},
	{
		id: 'ant-man-and-the-wasp',
		title: 'Ant-Man and the Wasp',
		timeline: '2018',
		era: '2016-2018',
		dot: '2018',
		type: 'movie',
		runtimeMinutes: 118,
		imdbId: 'tt5095030',
		essential: true
	},
	{
		id: 'avengers-infinity-war',
		title: 'Avengers: Infinity War',
		timeline: '2018',
		era: '2016-2018',
		dot: '2018',
		type: 'movie',
		runtimeMinutes: 149,
		imdbId: 'tt4154756',
		essential: true
	},
	{
		id: 'avengers-endgame',
		title: 'Avengers: Endgame',
		timeline: '2023',
		era: '2023',
		dot: '2023',
		type: 'movie',
		runtimeMinutes: 182,
		imdbId: 'tt4154796',
		essential: true
	},
	{
		id: 'loki-season-1',
		title: 'Loki season 1',
		timeline: 'Outside time',
		era: 'Outside time and multiverse',
		dot: '∞',
		type: 'series',
		imdbId: 'tt9140554',
		essential: true
	},
	{
		id: 'what-if-season-1',
		title: 'What If...? season 1',
		timeline: 'Multiverse',
		era: 'Outside time and multiverse',
		dot: '∞',
		type: 'series',
		imdbId: 'tt10168312',
		essential: false
	},
	{
		id: 'marvel-zombies',
		title: 'Marvel Zombies',
		timeline: '2023, alternate reality',
		era: 'Outside time and multiverse',
		dot: '2023',
		type: 'series',
		imdbId: 'tt16027014',
		essential: false
	},
	{
		id: 'wandavision',
		title: 'WandaVision',
		timeline: '2023',
		era: '2023',
		dot: '2023',
		type: 'series',
		imdbId: 'tt9140560',
		essential: true
	},
	{
		id: 'shang-chi',
		title: 'Shang-Chi and the Legend of the Ten Rings',
		timeline: '2024',
		era: '2024',
		dot: '2024',
		type: 'movie',
		runtimeMinutes: 132,
		imdbId: 'tt9376612',
		essential: true
	},
	{
		id: 'the-falcon-and-the-winter-soldier',
		title: 'The Falcon and the Winter Soldier',
		timeline: '2024',
		era: '2024',
		dot: '2024',
		type: 'series',
		imdbId: 'tt9208876',
		essential: true
	},
	{
		id: 'spider-man-far-from-home',
		title: 'Spider-Man: Far From Home',
		timeline: '2024',
		era: '2024',
		dot: '2024',
		type: 'movie',
		runtimeMinutes: 129,
		imdbId: 'tt6320628',
		essential: true
	},
	{
		id: 'eternals',
		title: 'Eternals',
		timeline: '2024',
		era: '2024',
		dot: '2024',
		type: 'movie',
		runtimeMinutes: 157,
		imdbId: 'tt9032400',
		essential: false
	},
	{
		id: 'spider-man-no-way-home',
		title: 'Spider-Man: No Way Home',
		timeline: '2024',
		era: '2024',
		dot: '2024',
		type: 'movie',
		runtimeMinutes: 150,
		imdbId: 'tt10872600',
		essential: true
	},
	{
		id: 'doctor-strange-in-the-multiverse-of-madness',
		title: 'Doctor Strange in the Multiverse of Madness',
		timeline: '2024',
		era: '2024',
		dot: '2024',
		type: 'movie',
		runtimeMinutes: 126,
		imdbId: 'tt9419884',
		essential: true
	},
	{
		id: 'hawkeye',
		title: 'Hawkeye',
		timeline: '2024',
		era: '2024',
		dot: '2024',
		type: 'series',
		imdbId: 'tt10160804',
		essential: true
	},
	{
		id: 'moon-knight',
		title: 'Moon Knight',
		timeline: '2025',
		era: '2025',
		dot: '2025',
		type: 'series',
		imdbId: 'tt10234724',
		essential: false
	},
	{
		id: 'black-panther-wakanda-forever',
		title: 'Black Panther: Wakanda Forever',
		timeline: '2025',
		era: '2025',
		dot: '2025',
		type: 'movie',
		runtimeMinutes: 161,
		imdbId: 'tt9114286',
		essential: true
	},
	{
		id: 'echo',
		title: 'Echo',
		timeline: '2025',
		era: '2025',
		dot: '2025',
		type: 'series',
		imdbId: 'tt13966962',
		essential: false
	},
	{
		id: 'she-hulk',
		title: 'She-Hulk: Attorney at Law',
		timeline: '2025',
		era: '2025',
		dot: '2025',
		type: 'series',
		imdbId: 'tt10857160',
		essential: false
	},
	{
		id: 'ms-marvel',
		title: 'Ms. Marvel',
		timeline: '2025',
		era: '2025',
		dot: '2025',
		type: 'series',
		imdbId: 'tt10857164',
		essential: true
	},
	{
		id: 'thor-love-and-thunder',
		title: 'Thor: Love and Thunder',
		timeline: '2025',
		era: '2025',
		dot: '2025',
		type: 'movie',
		runtimeMinutes: 119,
		imdbId: 'tt10648342',
		essential: false
	},
	{
		id: 'ironheart',
		title: 'Ironheart',
		timeline: '2025',
		era: '2025',
		dot: '2025',
		type: 'series',
		imdbId: 'tt13623126',
		essential: false
	},
	{
		id: 'werewolf-by-night',
		title: 'Werewolf by Night',
		timeline: '2025',
		era: '2025',
		dot: '2025',
		type: 'special',
		imdbId: 'tt15318872',
		essential: false
	},
	{
		id: 'guardians-holiday-special',
		title: 'The Guardians of the Galaxy Holiday Special',
		timeline: '2025',
		era: '2025',
		dot: '2025',
		type: 'special',
		imdbId: 'tt13623136',
		essential: false
	},
	{
		id: 'ant-man-and-the-wasp-quantumania',
		title: 'Ant-Man and the Wasp: Quantumania',
		timeline: '2026',
		era: '2026',
		dot: '2026',
		type: 'movie',
		runtimeMinutes: 125,
		imdbId: 'tt10954600',
		essential: true
	},
	{
		id: 'guardians-of-the-galaxy-vol-3',
		title: 'Guardians of the Galaxy Vol. 3',
		timeline: '2026',
		era: '2026',
		dot: '2026',
		type: 'movie',
		runtimeMinutes: 149,
		imdbId: 'tt6791350',
		essential: true
	},
	{
		id: 'secret-invasion',
		title: 'Secret Invasion',
		timeline: '2026',
		era: '2026',
		dot: '2026',
		type: 'series',
		imdbId: 'tt13157618',
		essential: true
	},
	{
		id: 'the-marvels',
		title: 'The Marvels',
		timeline: '2026',
		era: '2026',
		dot: '2026',
		type: 'movie',
		runtimeMinutes: 105,
		imdbId: 'tt10676048',
		essential: true
	},
	{
		id: 'loki-season-2',
		title: 'Loki season 2',
		timeline: 'Outside time',
		era: 'Outside time and multiverse',
		dot: '∞',
		type: 'series',
		imdbId: 'tt9140554',
		essential: true
	},
	{
		id: 'what-if-season-2',
		title: 'What If...? season 2',
		timeline: 'Multiverse',
		era: 'Outside time and multiverse',
		dot: '∞',
		type: 'series',
		imdbId: 'tt10168312',
		essential: false
	},
	{
		id: 'deadpool-and-wolverine',
		title: 'Deadpool & Wolverine',
		timeline: '2024, Earth-10005 and the Void',
		era: 'Outside time and multiverse',
		dot: '2024',
		type: 'movie',
		runtimeMinutes: 127,
		imdbId: 'tt6263850',
		essential: true
	},
	{
		id: 'agatha-all-along',
		title: 'Agatha All Along',
		timeline: '2026',
		era: '2026',
		dot: '2026',
		type: 'series',
		imdbId: 'tt15571732',
		essential: false
	},
	{
		id: 'what-if-season-3',
		title: 'What If...? season 3',
		timeline: 'Multiverse',
		era: 'Outside time and multiverse',
		dot: '∞',
		type: 'series',
		imdbId: 'tt10168312',
		essential: false
	},
	{
		id: 'spider-man-brand-new-day',
		title: 'Spider-Man: Brand New Day',
		timeline: '2026',
		era: '2026',
		dot: '2026',
		type: 'movie',
		imdbId: 'tt22084616',
		essential: true
	},
	{
		id: 'visionquest',
		title: 'VisionQuest',
		timeline: '2026',
		era: '2026',
		dot: '2026',
		type: 'series',
		imdbId: 'tt23112594',
		essential: true
	},
	{
		id: 'daredevil-born-again-season-1',
		title: 'Daredevil: Born Again season 1',
		timeline: '2026-2027',
		era: '2026-2027',
		dot: '2026',
		type: 'series',
		imdbId: 'tt18923754',
		essential: true
	},
	{
		id: 'captain-america-brave-new-world',
		title: 'Captain America: Brave New World',
		timeline: '2026-2027',
		era: '2026-2027',
		dot: '2026',
		type: 'movie',
		runtimeMinutes: 118,
		imdbId: 'tt14513804',
		essential: true
	},
	{
		id: 'thunderbolts',
		title: 'Thunderbolts*',
		timeline: '2027',
		era: '2027',
		dot: '2027',
		type: 'movie',
		runtimeMinutes: 126,
		imdbId: 'tt20969586',
		essential: true
	},
	{
		id: 'the-fantastic-four-first-steps',
		title: 'The Fantastic Four: First Steps',
		timeline: '1964, Earth-828',
		era: 'Earth-828',
		dot: '1964',
		type: 'movie',
		runtimeMinutes: 115,
		imdbId: 'tt10676052',
		essential: true
	},
	{
		id: 'avengers-doomsday',
		title: 'Avengers: Doomsday',
		timeline: '2027',
		era: '2027',
		dot: '2027',
		type: 'movie',
		imdbId: 'tt21357150',
		essential: true
	},
	{
		id: 'wonder-man-season-1',
		title: 'Wonder Man season 1',
		timeline: '2026',
		era: '2026',
		dot: '2026',
		type: 'series',
		imdbId: 'tt21066182',
		essential: false
	},
	{
		id: 'wonder-man-season-2',
		title: 'Wonder Man season 2',
		timeline: '2026-2027',
		era: '2026-2027',
		dot: '2026',
		type: 'series',
		imdbId: 'tt21066182',
		essential: false
	},
	{
		id: 'daredevil-born-again-season-2',
		title: 'Daredevil: Born Again season 2',
		timeline: '2027',
		era: '2027',
		dot: '2027',
		type: 'series',
		imdbId: 'tt18923754',
		essential: true
	},
	{
		id: 'the-punisher-one-last-kill',
		title: 'The Punisher: One Last Kill',
		timeline: '2027',
		era: '2027',
		dot: '2027',
		type: 'special',
		imdbId: 'tt36042156',
		essential: false
	},
	{
		id: 'avengers-secret-wars',
		title: 'Avengers: Secret Wars',
		timeline: '2027',
		era: '2027',
		dot: '2027',
		type: 'movie',
		imdbId: 'tt21361444',
		essential: true
	}
];
