import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "fi";

const dict = {
  forecastTitle: { en: "Weekly resistance forecast", fi: "Viikoittainen resistenssiennuste" },
  forecastCaution: { en: "Only four weeks were used to compare models. The winning error may be optimistic; no prediction uncertainty range is validated.", fi: "Mallien vertailussa käytettiin vain neljää viikkoa. Voittavan mallin virhe voi olla optimistinen; ennusteen epävarmuusväliä ei ole validoitu." },
  forecastWeekWarnings: { en: "Weeks excluded from training: missing/incomplete {missing}, small sample {small}, results needing review {quality}.", fi: "Opetusdatasta pois jätetyt viikot: puuttuvat/vajaat {missing}, vähän tuloksia {small}, tarkistettavat tulokset {quality}." },
  forecastSelect: { en: "Select one bacterium and one antibiotic to view the weekly forecast.", fi: "Valitse yksi bakteeri ja yksi antibiootti nähdäksesi viikkoennusteen." },
  forecastSafety: { en: "Experimental estimate, not a treatment recommendation. Past validation does not guarantee next week's accuracy.", fi: "Kokeellinen arvio, ei hoitosuositus. Aiempi validointi ei takaa seuraavan viikon tarkkuutta." },
  forecastObserved: { en: "Latest completed week", fi: "Viimeisin päättynyt viikko" },
  forecastNext: { en: "Next week · forecast", fi: "Seuraava viikko · ennuste" },
  forecastChange: { en: "Change (percentage points)", fi: "Muutos (prosenttiyksikköä)" },
  forecastError: { en: "Validation error (MAE, percentage points)", fi: "Validointivirhe (MAE, prosenttiyksikköä)" },
  forecastLinear: { en: "Linear regression", fi: "Lineaarinen regressio" },
  forecastHolt: { en: "Holt exponential smoothing", fi: "Holtin eksponentiaalinen tasoitus" },
  forecastBaseline: { en: "Baseline: previous week's rate", fi: "Vertailumalli: edellisen viikon osuus" },
  forecastHistory: { en: "Not enough continuous weekly history. Need {weeks} consecutive usable weeks; available: {count}.", fi: "Yhtenäistä viikkohistoriaa ei ole riittävästi. Tarvitaan {weeks} peräkkäistä käyttökelpoista viikkoa; saatavilla: {count}." },
  forecastGap: { en: "No eligible results in the latest week. Missing weeks are not zero resistance.", fi: "Viimeisellä viikolla ei ole hyväksyttyjä tuloksia. Puuttuvat viikot eivät tarkoita nollaresistenssiä." },
  forecastQuality: { en: "Some results are missing or cannot be used. This week is excluded from forecast training.", fi: "Osa tuloksista puuttuu tai niitä ei voida käyttää. Viikko jätetään pois ennusteen opetusdatasta." },
  forecastIncomplete: { en: "The available dates do not cover a complete week.", fi: "Saatavilla olevat päivämäärät eivät kata kokonaista viikkoa." },
  forecastValidation: { en: "Models compared on {count} later weeks, using only earlier weeks for each prediction. Lowest mean absolute error wins; the baseline wins ties.", fi: "Malleja verrattiin {count} myöhemmällä viikolla käyttäen vain aiempia viikkoja kussakin ennusteessa. Pienin keskimääräinen absoluuttinen virhe voittaa; tasatilanteessa valitaan vertailumalli." },
  forecastDetails: { en: "Weekly counts and model comparison", fi: "Viikkomäärät ja mallien vertailu" },
  forecastMethod: { en: "First isolate per patient and bacterium in each week, after the selected filters. Only S+R contributes to the rate. Gaps and weeks with too few or unusable results break training history. Recurring patients may affect the series; this is not an independent-patient statistical test. Forecasts are limited to 0–100%. No seasonal or case-mix adjustment.", fi: "Ensimmäinen isolaatti potilasta ja bakteeria kohden kullakin viikolla valittujen suodattimien jälkeen. Vain S+R sisältyy osuuteen. Puuttuvat viikot sekä liian vähäiset tai käyttökelvottomat tulokset katkaisevat opetushistorian. Toistuvat potilaat voivat vaikuttaa sarjaan; tämä ei ole riippumattomien potilaiden tilastollinen testi. Ennusteet rajataan välille 0–100 %. Kausivaihtelua tai potilasrakennetta ei vakioida." },
  anomalyTitle: { en: "Unusual resistance changes", fi: "Poikkeavat resistenssimuutokset" },
  anomalySignal: { en: "Unusual increase detected — review the data.", fi: "Poikkeava kasvu havaittu — tarkista tiedot." },
  anomalyNone: { en: "No unusual increases detected in the groups assessed.", fi: "Arvioiduissa ryhmissä ei havaittu poikkeavaa kasvua." },
  anomalyHistory: { en: "Not enough historical data", fi: "Historiatietoa ei ole riittävästi" },
  anomalyNoData: { en: "No matching results to assess.", fi: "Arvioitavia tuloksia ei löytynyt." },
  anomalySafety: { en: "A signal for review, not proof of an outbreak or a clinical cause. This comparison is provisional.", fi: "Signaali tarkistusta varten, ei todiste epidemiasta tai kliinisestä syystä. Vertailu on alustava." },
  anomalyBaseline: { en: "Historical baseline", fi: "Historiallinen vertailutaso" },
  anomalyCurrent: { en: "Current period", fi: "Nykyinen jakso" },
  anomalyChange: { en: "Change (percentage points)", fi: "Muutos (prosenttiyksikköä)" },
  anomalyCompared: { en: "Comparison periods", fi: "Vertailujaksot" },
  anomalyAssessed: { en: "Groups assessed", fi: "Arvioidut ryhmät" },
  anomalyWithheld: { en: "Groups not assessed", fi: "Arvioimatta jääneet ryhmät" },
  anomalySmall: { en: "Too few eligible results in the current period.", fi: "Nykyisellä jaksolla on liian vähän hyväksyttyjä tuloksia." },
  anomalyMissingPeriod: { en: "A matching group is missing from a comparison period.", fi: "Vastaava ryhmä puuttuu yhdeltä vertailujaksolta." },
  anomalyIncomplete: { en: "The current period or its history extends beyond the available sample dates, or the period has not ended.", fi: "Nykyinen jakso tai sen historia ulottuu saatavilla olevien näytepäivien ulkopuolelle, tai jakso ei ole päättynyt." },
  anomalyQuality: { en: "Some results are missing or cannot be used. Review the data before comparing.", fi: "Osa tuloksista puuttuu tai niitä ei voida käyttää. Tarkista tiedot ennen vertailua." },
  anomalyUnequal: { en: "The ISO years have different lengths and cannot be compared here.", fi: "ISO-vuodet ovat eripituisia eikä niitä voida vertailla tässä." },
  anomalyOverlap: { en: "Some people have results in more than one period. This comparison cannot safely assess those repeated results.", fi: "Joillakin henkilöillä on tuloksia useammalla jaksolla. Näitä toistuvia tuloksia ei voida arvioida turvallisesti tässä vertailussa." },
  anomalyMethod: { en: "Assessment method", fi: "Arviointimenetelmä" },
  anomalyUnassessed: { en: "No groups could be assessed. See the specific reasons below.", fi: "Yhtäkään ryhmää ei voitu arvioida. Katso tarkat syyt alta." },
  anomalyReasons: { en: "Reasons groups were not assessed", fi: "Syyt ryhmien arvioimatta jättämiseen" },
  anomalyNegative: { en: "Assessed — no unusual increase detected", fi: "Arvioitu — poikkeavaa kasvua ei havaittu" },
  anomalyNotAssessed: { en: "Not assessed", fi: "Ei arvioitu" },
  anomalySelectedPatients: { en: "Patients with selected isolates", fi: "Potilaat, joilta valittiin isolaatti" },
  anomalyEligiblePatients: { en: "Patients with eligible results", fi: "Potilaat, joilla on hyväksytty tulos" },
  anomalyRepeatedPatients: { en: "Patients with eligible results in multiple periods", fi: "Potilaat, joilla on hyväksytty tulos usealla jaksolla" },
  anomalyMinimum: { en: "Minimum per period", fi: "Vähimmäismäärä jaksolla" },
  anomalySmallDetail: { en: "{count} eligible results; at least {minimum} are needed in the current period.", fi: "{count} hyväksyttyä tulosta; nykyisellä jaksolla tarvitaan vähintään {minimum}." },
  anomalyOverlapDetail: { en: "{count} patients have eligible results in multiple comparison periods. An independent-observation test cannot safely assess this group.", fi: "{count} potilaalla on hyväksytty tulos usealla vertailujaksolla. Riippumattomia havaintoja edellyttävä testi ei voi arvioida tätä ryhmää turvallisesti." },
  anomalyMethodText: { en: "The current period is compared with the combined resistant and susceptible counts from the three preceding, non-overlapping periods. Each period needs at least {minimum} eligible results. An exact statistical test accounts for sample size; correction for all assessed groups limits chance signals. Repeated testing across different selections is not covered by this correction.", fi: "Nykyistä jaksoa verrataan kolmen edellisen, päällekkäisyydettömän jakson yhdistettyihin resistenttien ja herkkien tulosten määriin. Jokaisella jaksolla tarvitaan vähintään {minimum} hyväksyttyä tulosta. Tarkka tilastollinen testi huomioi otoskoon; kaikkien arvioitujen ryhmien korjaus vähentää sattumasignaaleja. Korjaus ei kata toistuvia testejä eri valinnoilla." },
  anomalyInterval: { en: "95% uncertainty interval", fi: "95 %:n epävarmuusväli" },
  appName: { en: "Antibiotic Efficacy Indicator", fi: "Antibioottien tehoindikaattori" },
  signIn: { en: "Sign in", fi: "Kirjaudu" },
  signUp: { en: "Create account", fi: "Luo tili" },
  signOut: { en: "Sign out", fi: "Kirjaudu ulos" },
  email: { en: "Email", fi: "Sähköposti" },
  password: { en: "Password", fi: "Salasana" },
  google: { en: "Continue with Google", fi: "Jatka Googlella" },
  overview: { en: "Data overview", fi: "Aineiston yleiskatsaus" },
  imports: { en: "Imports", fi: "Tuonnit" },
  noRole: {
    en: "Your account has no access role yet. Ask an administrator to grant viewer, importer or admin access.",
    fi: "Tililläsi ei ole vielä käyttöoikeutta. Pyydä ylläpitäjää myöntämään oikeus.",
  },
  dataset: { en: "Dataset", fi: "Aineisto" },
  rows: { en: "Rows", fi: "Rivit" },
  chooseFile: { en: "CSV file", fi: "CSV-tiedosto" },
  validate: { en: "Validate", fi: "Tarkista" },
  importNow: { en: "Import", fi: "Tuo" },
  status: { en: "Status", fi: "Tila" },
  inserted: { en: "Inserted", fi: "Lisätty" },
  duplicates: { en: "Duplicates skipped", fi: "Ohitetut kaksoiskappaleet" },
  rejected: { en: "Rejected", fi: "Hylätty" },
  recentRuns: { en: "Recent import runs", fi: "Viimeisimmät tuonnit" },
  importerOnly: { en: "Only importers and administrators can upload data.", fi: "Vain tuojat ja ylläpitäjät voivat ladata aineistoa." },
  resistance: { en: "Resistance", fi: "Resistenssi" },
  periodKind: { en: "Reporting period", fi: "Raportointijakso" },
  annual: { en: "Annual (ISO year)", fi: "Vuosittain (ISO-vuosi)" },
  fourWeek: { en: "Four-week", fi: "Neljän viikon jakso" },
  isoYear: { en: "ISO year", fi: "ISO-vuosi" },
  isoWeek: { en: "ISO week", fi: "ISO-viikko" },
  organism: { en: "Organism", fi: "Organismi" },
  antibiotic: { en: "Antibiotic", fi: "Antibiootti" },
  ward: { en: "Ward", fi: "Osasto" },
  specimen: { en: "Specimen", fi: "Näytetyyppi" },
  allOption: { en: "All", fi: "Kaikki" },
  loading: { en: "Loading…", fi: "Ladataan…" },
  apiError: { en: "The surveillance API could not be reached. Check your access and try again.", fi: "Seurantarajapintaan ei saatu yhteyttä. Tarkista käyttöoikeutesi ja yritä uudelleen." },
  noData: { en: "No data for this selection.", fi: "Tällä valinnalla ei ole aineistoa." },
  provisional: { en: "Provisional clinical policy — not approved for clinical use.", fi: "Alustava kliininen käytäntö — ei hyväksytty kliiniseen käyttöön." },
  summary: { en: "Summary", fi: "Yhteenveto" },
  trend: { en: "Trend over time", fi: "Kehitys ajassa" },
  trendNote: { en: "Each point is one reporting period.", fi: "Jokainen piste on yksi raportointijakso." },
  breakdown: { en: "Breakdown by organism, antibiotic, ward and specimen", fi: "Erittely organismin, antibiootin, osaston ja näytetyypin mukaan" },
  rate: { en: "Resistance %", fi: "Resistenssi %" },
  resistant: { en: "Resistant (R)", fi: "Resistentit (R)" },
  susceptible: { en: "Susceptible (S)", fi: "Herkät (S)" },
  intermediate: { en: "Intermediate (I)", fi: "Välijoukko (I)" },
  eligible: { en: "Eligible denominator (S+R)", fi: "Kelvollinen nimittäjä (S+R)" },
  selectedIsolates: { en: "Selected isolates", fi: "Valitut isolaatit" },
  notReported: { en: "Not reported", fi: "Ei raportoitu" },
  insufficientSample: { en: "Below 30 eligible isolates — rate not reported", fi: "Alle 30 kelvollista isolaattia — lukemaa ei raportoida" },
  zeroDenominator: { en: "No eligible S/R observations", fi: "Ei kelvollisia S/R-havaintoja" },
  reportableWithExclusions: { en: "Reportable with exclusions", fi: "Raportoitava poissulkemisin" },
  reportable: { en: "Reportable", fi: "Raportoitava" },
  warnings: { en: "Data-quality warnings", fi: "Tiedon laatuvaroitukset" },
  warn_intermediate_excluded: { en: "Intermediate (I) results are excluded from the denominator", fi: "Välijoukon (I) tulokset on jätetty pois nimittäjästä" },
  warn_missing_results: { en: "Some results are missing (never treated as susceptible)", fi: "Osa tuloksista puuttuu (niitä ei koskaan tulkita herkiksi)" },
  warn_invalid_results: { en: "Some results are invalid and excluded", fi: "Osa tuloksista on virheellisiä ja jätetty pois" },
  warn_uninterpretable_results: { en: "Some results are uninterpretable and excluded", fi: "Osa tuloksista on tulkinnan ulkopuolella ja jätetty pois" },
  warn_repeated_isolates_excluded: { en: "Repeated isolates were excluded by the deduplication policy", fi: "Toistuvat isolaatit on jätetty pois deduplikointikäytännön mukaisesti" },
  warn_no_data: { en: "No data in this period", fi: "Tällä jaksolla ei ole aineistoa" },
  warn_provisional: { en: "Provisional clinical policy", fi: "Alustava kliininen käytäntö" },
  markers: { en: "Resistance markers (lab flags)", fi: "Resistenssimerkit (laboratorion merkinnät)" },
  markersNote: {
    en: "Lab flags are the source of truth, shown separately from antibiotic resistance percentages; unknowns are never derived from susceptibility results.",
    fi: "Laboratorion merkinnät ovat lähdetieto ja näytetään erillään antibioottiresistenssiprosenteista; tuntemattomia ei koskaan johdeta herkkyystuloksista.",
  },
  markerPositive: { en: "Positive", fi: "Positiivinen" },
  markerUnknown: { en: "Unknown", fi: "Tuntematon" },
  markerNegative: { en: "Negative", fi: "Negatiivinen" },
  weekAxis: { en: "W", fi: "vko " },
  weekTooltip: { en: "Week {week}, {year}", fi: "Viikko {week} / {year}" },
  yearTooltip: { en: "Year {year}", fi: "Vuosi {year}" },
  periodShown: { en: "Period", fi: "Jakso" },
  colBacterium: { en: "Bacterium", fi: "Bakteeri" },
  colAntibiotic: { en: "Antibiotic", fi: "Antibiootti" },
  colUnit: { en: "Healthcare unit", fi: "Hoitoyksikkö" },
  colSample: { en: "Sample type", fi: "Näytetyyppi" },
  colResistant: { en: "Resistant results", fi: "Resistentit tulokset" },
  colSusceptible: { en: "Susceptible results", fi: "Herkät tulokset" },
  colIntermediate: { en: "Intermediate results", fi: "Välimuotoiset tulokset" },
  colEligible: { en: "Eligible results", fi: "Hyväksytyt tulokset" },
  colRate: { en: "Resistance rate", fi: "Resistenssiosuus" },
  colDetails: { en: "Details", fi: "Tiedot" },
  showDetails: { en: "Show counts", fi: "Näytä määrät" },
  hideDetails: { en: "Hide counts", fi: "Piilota määrät" },
  sortBy: { en: "Sort by", fi: "Järjestä" },
  sortRateDesc: { en: "Resistance rate (highest first)", fi: "Resistenssiosuus (suurin ensin)" },
  sortRateAsc: { en: "Resistance rate (lowest first)", fi: "Resistenssiosuus (pienin ensin)" },
  sortEligibleDesc: { en: "Eligible results (most first)", fi: "Hyväksytyt tulokset (eniten ensin)" },
  sortEligibleAsc: { en: "Eligible results (fewest first)", fi: "Hyväksytyt tulokset (vähiten ensin)" },
  searchTable: { en: "Search table", fi: "Hae taulukosta" },
  searchPlaceholder: { en: "Bacterium, antibiotic, unit or sample type", fi: "Bakteeri, antibiootti, yksikkö tai näytetyyppi" },
  noMatches: { en: "No rows match your search.", fi: "Haku ei tuottanut rivejä." },
  rowsShown: { en: "rows shown", fi: "riviä näkyvissä" },
  periodCovers: { en: "Results cover samples taken from", fi: "Tulokset kattavat näytteet aikaväliltä" },
  periodTo: { en: "to", fi: "–" },
  inclusive: { en: "(inclusive)", fi: "(mukaan lukien)" },
  ofEligible: { en: "of", fi: "/" },
  helpTitle: { en: "How is the resistance rate calculated?", fi: "Miten resistenssiosuus lasketaan?" },
  helpFormula: {
    en: "Resistance rate = resistant results ÷ (resistant + susceptible results) × 100. Only resistant and susceptible results are eligible. Missing or invalid results are excluded, never counted as susceptible. Only the first isolate per patient, bacterium and period is counted (provisional rule).",
    fi: "Resistenssiosuus = resistentit tulokset ÷ (resistentit + herkät tulokset) × 100. Vain resistentit ja herkät tulokset hyväksytään laskentaan. Puuttuvat tai virheelliset tulokset jätetään pois, eikä niitä koskaan lasketa herkiksi. Vain ensimmäinen isolaatti potilasta, bakteeria ja jaksoa kohden lasketaan (alustava sääntö).",
  },
  helpSample: {
    en: "A rate is shown only when there are at least 30 eligible results. With fewer results the rate could change a lot by chance, so it is marked as too few results instead of being shown. A missing rate is not the same as 0%.",
    fi: "Osuus näytetään vain, kun hyväksyttyjä tuloksia on vähintään 30. Pienemmällä määrällä osuus voisi vaihdella sattumalta paljon, joten se merkitään liian vähäiseksi eikä sitä näytetä. Puuttuva osuus ei tarkoita 0 %.",
  },
  helpNoRisk: {
    en: "No high/low risk labels are shown, because no approved clinical threshold has been confirmed.",
    fi: "Korkean tai matalan riskin merkintöjä ei näytetä, koska hyväksyttyä kliinistä raja-arvoa ei ole vahvistettu.",
  },
  rateBarLabel: { en: "Resistance rate bar", fi: "Resistenssiosuuden palkki" },
  statusAvailable: { en: "Rate available", fi: "Osuus saatavilla" },
  statusSmall: { en: "Small sample", fi: "Vähän tuloksia" },
  statusCheck: { en: "Check data", fi: "Tarkista tiedot" },
  statusEmpty: { en: "No results", fi: "Ei tuloksia" },
  statusUnavailable: { en: "Unavailable", fi: "Ei saatavilla" },
  statusWhy: { en: "Why?", fi: "Miksi?" },
  statusFilter: { en: "Result status", fi: "Tulosten tila" },
  statusNeedsChecking: { en: "Needs checking", fi: "Tarkistettavaa" },
  statusAvailableExplanation: { en: "There are enough results to calculate the percentage.", fi: "Tuloksia on riittävästi prosenttiosuuden laskemiseen." },
  statusSmallCount: { en: "{count} results counted. We need at least {minimum} to show the percentage.", fi: "{count} tulosta laskettu. Prosenttiosuuden näyttämiseen tarvitaan vähintään {minimum} tulosta." },
  statusSmallExplanation: { en: "We hide the percentage when there are too few results. A small group can give a less stable estimate. The results are not missing; we are just not showing the percentage.", fi: "Emme näytä prosenttiosuutta, kun tuloksia on liian vähän. Pienen ryhmän arvio voi vaihdella enemmän. Tulokset eivät puutu, mutta emme näytä prosenttiosuutta." },
  statusCheckExplanation: { en: "Some results could not be used. Please check the data.", fi: "Osaa tuloksista ei voitu käyttää. Tarkista tiedot." },
  statusEmptyExplanation: { en: "No matching results were found for these filters.", fi: "Näillä suodattimilla ei löytynyt tuloksia." },
  statusUnavailableExplanation: { en: "The information could not be loaded. Please try again.", fi: "Tietoja ei voitu ladata. Yritä uudelleen." },
  statusRetry: { en: "Try again", fi: "Yritä uudelleen" },
  statusMissing: { en: "Missing results", fi: "Puuttuvat tulokset" },
  statusInvalid: { en: "Results needing correction", fi: "Korjattavat tulokset" },
  statusUninterpretable: { en: "Results that could not be interpreted", fi: "Tulokset, joita ei voitu tulkita" },
  about: { en: "About", fi: "Tietoa" },
  aboutEyebrow: { en: "About the project", fi: "Tietoa hankkeesta" },
  aboutHeading: { en: "About AEI", fi: "Tietoa AEI:stä" },
  aboutIntro: {
    en: "AEI is a data-driven platform designed to support antibiotic resistance surveillance by helping users explore resistance trends, review historical data, and understand potential changes through weekly forecasting. The platform aims to make microbiology data more accessible and support informed surveillance and research.",
    fi: "AEI on datapohjainen alusta, joka on suunniteltu tukemaan antibioottiresistenssin seurantaa auttamalla käyttäjiä tarkastelemaan resistenssitrendejä, katsomaan aiempaa aineistoa ja ymmärtämään mahdollisia muutoksia viikoittaisen ennusteen avulla. Alustan tavoitteena on tehdä mikrobiologian aineistosta helpommin lähestyttävää ja tukea tietoon perustuvaa seurantaa ja tutkimusta.",
  },
  missionTitle: { en: "Why surveillance matters", fi: "Miksi seuranta on tärkeää" },
  missionBody: {
    en: "Antibiotic resistance develops gradually, and treatment choices depend on local knowledge of which bacteria still respond to which drugs. Surveillance turns routine laboratory results into a picture of how effectiveness is changing over time, so that clinicians, researchers and public-health teams can act on evidence rather than assumption.",
    fi: "Resistenssi kehittyy vähitellen, ja hoitovaihtoehdot riippuvat paikallisesta tiedosta siitä, mitkä bakteerit vielä reagoivat mihinkin lääkeaineeseen. Seuranta muuttaa rutiiniset laboratoriotulokset kuvaksi siitä, miten teho muuttuu ajan myötä, jolloin kliinikot, tutkijat ja terveysviranomaiset voivat toimia näytön eivätkä oletusten varassa.",
  },
  missionSecond: {
    en: "AEI keeps its calculation rules visible: how results are selected, how they are counted, and when a figure is deliberately withheld. That way any number shown on the dashboard can be traced back to the data behind it.",
    fi: "AEI pitää laskentansa säännöt näkyvinä: miten tulokset valitaan, kuinka ne lasketaan ja milloin luku jätetään tarkoituksella näyttämättä. Näin jokainen kojelaudalla näytetty luku voidaan jäljittää sitä tuottaneeseen aineistoon.",
  },
  teamTitle: { en: "Our team", fi: "Tiimimme" },
  teamIntro: { en: "AEI is built and maintained by the people listed below.", fi: "AEI:tä rakentavat ja ylläpitävät alla mainitut henkilöt." },
  roleResearcher: { en: "Researcher, Medtech", fi: "Tutkija, Medtech" },
  roleDoctoral: { en: "Doctoral Researcher", fi: "Tohtorikoulutettava" },
  affTampere: { en: "Tampere University", fi: "Tampereen yliopisto" },
  affHelsinki: { en: "University of Helsinki", fi: "Helsingin yliopisto" },
  aboutDashboard: { en: "Open the dashboard", fi: "Avaa kojelauta" },
} as const;

export type Key = keyof typeof dict;
const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>({
  lang: "en",
  setLang: () => {},
  t: (k) => dict[k].en,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const s = localStorage.getItem("aei-lang");
    if (s === "fi" || s === "en") setLangState(s);
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("aei-lang", l);
  };
  return <Ctx.Provider value={{ lang, setLang, t: (k) => dict[k][lang] }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);

/** Pick a translated label from a reference row with label_en / label_fi columns. */
export function pickLabel(row: { label_en: string; label_fi: string }, lang: Lang) {
  return lang === "fi" ? row.label_fi : row.label_en;
}

export function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex rounded-md border border-border text-xs font-mono">
      {(["en", "fi"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-2 py-1 uppercase ${lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
