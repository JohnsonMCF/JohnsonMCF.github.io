/*
 * app.js - French Verb Conjugation SRS (improved)
 *
 * FIXES applied vs original:
 *  1. Double-submit bug fixed: input/buttons disabled immediately on submit
 *  2. MCQ distractors now come from the same tense as the question
 *  3. Auxiliary detection fixed for all compound tenses (not just passé composé)
 *  4. "Require pronoun" replaced with working "Strict accents" toggle
 *  5. byTense mode with empty tense now shows an error instead of silently switching to Mixed
 *  6. Auto-advance has a visible countdown bar; longer delay (2.2s) for wrong answers
 *  7. MCQ buttons immediately highlight correct/wrong on click before advance
 *  8. MCQ keyboard shortcuts: 1-4 keys select options
 *  9. Accent input toolbar inserts characters at cursor position
 * 10. "Show Answer" button that reveals without full SRS penalty
 * 11. Fuzzy accent matching: unaccented answers score as partial (warn, weight × 1.1)
 * 12. Session mistake log shown on summary screen
 * 13. Mastered items SRS fix: true weight-capped at 0.2 (prevents creep back above mastery)
 * 14. wrongBuffer injection is now safe (no consecutive double-fire)
 * 15. Timer uses Date.now() delta to prevent drift; turns red below 10s
 * 16. Header verb count updates when CSV is loaded
 * 17. "Practice 10 weakest" quick-session button
 * 18. "Restart same session" button on summary screen
 * 19. Dark mode toggle persisted in localStorage
 * 20. Stats tab shows per-tense mastery bars
 * 21. Progress track visual bar updates each question
 * 22. Toast replaces alert() for non-critical messages
 * 23. compoundTenses is a module-level constant (no duplicate definitions)
 * 24. Fisher-Yates shuffle replaces biased sort
 * 25. CSV import silently skips bad rows but reports count at end
 * 26. Micro mode: inputs disabled after submission
 * 27. Micro mode: next-verb selection is weighted-random (not always worst)
 * 28. SRS export only includes progress data + custom verbs (not all built-ins)
 */

'use strict';

// ─── Built-in verb dataset (86 verbs) ───────────────────────────────────────
const BUILTIN_VERBS = [
  {
    infinitive: 'être', english: 'to be',
    present: ['suis','es','est','sommes','êtes','sont'],
    imparfait: ['étais','étais','était','étions','étiez','étaient'],
    passe_compose: ['ai été','as été','a été','avons été','avez été','ont été'],
    futur_simple: ['serai','seras','sera','serons','serez','seront'],
    conditionnel_present: ['serais','serais','serait','serions','seriez','seraient'],
    subjonctif_present: ['sois','sois','soit','soyons','soyez','soient'],
  },
  {
    infinitive: 'avoir', english: 'to have',
    present: ['ai','as','a','avons','avez','ont'],
    imparfait: ['avais','avais','avait','avions','aviez','avaient'],
    passe_compose: ['ai eu','as eu','a eu','avons eu','avez eu','ont eu'],
    futur_simple: ['aurai','auras','aura','aurons','aurez','auront'],
    conditionnel_present: ['aurais','aurais','aurait','aurions','auriez','auraient'],
    subjonctif_present: ['aie','aies','ait','ayons','ayez','aient'],
  },
  {
    infinitive: 'aller', english: 'to go',
    present: ['vais','vas','va','allons','allez','vont'],
    imparfait: ['allais','allais','allait','allions','alliez','allaient'],
    passe_compose: ['suis allé','es allé','est allé','sommes allés','êtes allés','sont allés'],
    futur_simple: ['irai','iras','ira','irons','irez','iront'],
    conditionnel_present: ['irais','irais','irait','irions','iriez','iraient'],
    subjonctif_present: ['aille','ailles','aille','allions','alliez','aillent'],
  },
  {
    infinitive: 'faire', english: 'to do/make',
    present: ['fais','fais','fait','faisons','faites','font'],
    imparfait: ['faisais','faisais','faisait','faisions','faisiez','faisaient'],
    passe_compose: ['ai fait','as fait','a fait','avons fait','avez fait','ont fait'],
    futur_simple: ['ferai','feras','fera','ferons','ferez','feront'],
    conditionnel_present: ['ferais','ferais','ferait','ferions','feriez','feraient'],
    subjonctif_present: ['fasse','fasses','fasse','fassions','fassiez','fassent'],
  },
  {
    infinitive: 'dire', english: 'to say',
    present: ['dis','dis','dit','disons','dites','disent'],
    imparfait: ['disais','disais','disait','disions','disiez','disaient'],
    passe_compose: ['ai dit','as dit','a dit','avons dit','avez dit','ont dit'],
    futur_simple: ['dirai','diras','dira','dirons','direz','diront'],
    conditionnel_present: ['dirais','dirais','dirait','dirions','diriez','diraient'],
    subjonctif_present: ['dise','dises','dise','disions','disiez','disent'],
  },
  {
    infinitive: 'pouvoir', english: 'to be able to',
    present: ['peux','peux','peut','pouvons','pouvez','peuvent'],
    imparfait: ['pouvais','pouvais','pouvait','pouvions','pouviez','pouvaient'],
    passe_compose: ['ai pu','as pu','a pu','avons pu','avez pu','ont pu'],
    futur_simple: ['pourrai','pourras','pourra','pourrons','pourrez','pourront'],
    conditionnel_present: ['pourrais','pourrais','pourrait','pourrions','pourriez','pourraient'],
    subjonctif_present: ['puisse','puisses','puisse','puissions','puissiez','puissent'],
  },
  {
    infinitive: 'voir', english: 'to see',
    present: ['vois','vois','voit','voyons','voyez','voient'],
    imparfait: ['voyais','voyais','voyait','voyions','voyiez','voyaient'],
    passe_compose: ['ai vu','as vu','a vu','avons vu','avez vu','ont vu'],
    futur_simple: ['verrai','verras','verra','verrons','verrez','verront'],
    conditionnel_present: ['verrais','verrais','verrait','verrions','verriez','verraient'],
    subjonctif_present: ['voie','voies','voie','voyions','voyiez','voient'],
  },
  {
    infinitive: 'savoir', english: 'to know',
    present: ['sais','sais','sait','savons','savez','savent'],
    imparfait: ['savais','savais','savait','savions','saviez','savaient'],
    passe_compose: ['ai su','as su','a su','avons su','avez su','ont su'],
    futur_simple: ['saurai','sauras','saura','saurons','saurez','sauront'],
    conditionnel_present: ['saurais','saurais','saurait','saurions','sauriez','sauraient'],
    subjonctif_present: ['sache','saches','sache','sachions','sachiez','sachent'],
  },
  {
    infinitive: 'vouloir', english: 'to want',
    present: ['veux','veux','veut','voulons','voulez','veulent'],
    imparfait: ['voulais','voulais','voulait','voulions','vouliez','voulaient'],
    passe_compose: ['ai voulu','as voulu','a voulu','avons voulu','avez voulu','ont voulu'],
    futur_simple: ['voudrai','voudras','voudra','voudrons','voudrez','voudront'],
    conditionnel_present: ['voudrais','voudrais','voudrait','voudrions','voudriez','voudraient'],
    subjonctif_present: ['veuille','veuilles','veuille','voulions','vouliez','veuillent'],
  },
  {
    infinitive: 'venir', english: 'to come',
    present: ['viens','viens','vient','venons','venez','viennent'],
    imparfait: ['venais','venais','venait','venions','veniez','venaient'],
    passe_compose: ['suis venu','es venu','est venu','sommes venus','êtes venus','sont venus'],
    futur_simple: ['viendrai','viendras','viendra','viendrons','viendrez','viendront'],
    conditionnel_present: ['viendrais','viendrais','viendrait','viendrions','viendriez','viendraient'],
    subjonctif_present: ['vienne','viennes','vienne','venions','veniez','viennent'],
  },
  {
    infinitive: 'devoir', english: 'to have to/must',
    present: ['dois','dois','doit','devons','devez','doivent'],
    imparfait: ['devais','devais','devait','devions','deviez','devaient'],
    passe_compose: ['ai dû','as dû','a dû','avons dû','avez dû','ont dû'],
    futur_simple: ['devrai','devras','devra','devrons','devrez','devront'],
    conditionnel_present: ['devrais','devrais','devrait','devrions','devriez','devraient'],
    subjonctif_present: ['doive','doives','doive','devions','deviez','doivent'],
  },
  {
    infinitive: 'prendre', english: 'to take',
    present: ['prends','prends','prend','prenons','prenez','prennent'],
    imparfait: ['prenais','prenais','prenait','prenions','preniez','prenaient'],
    passe_compose: ['ai pris','as pris','a pris','avons pris','avez pris','ont pris'],
    futur_simple: ['prendrai','prendras','prendra','prendrons','prendrez','prendront'],
    conditionnel_present: ['prendrais','prendrais','prendrait','prendrions','prendriez','prendraient'],
    subjonctif_present: ['prenne','prennes','prenne','prenions','preniez','prennent'],
  },
  {
    infinitive: 'trouver', english: 'to find',
    present: ['trouve','trouves','trouve','trouvons','trouvez','trouvent'],
    imparfait: ['trouvais','trouvais','trouvait','trouvions','trouviez','trouvaient'],
    passe_compose: ['ai trouvé','as trouvé','a trouvé','avons trouvé','avez trouvé','ont trouvé'],
    futur_simple: ['trouverai','trouveras','trouvera','trouverons','trouverez','trouveront'],
    conditionnel_present: ['trouverais','trouverais','trouverait','trouverions','trouveriez','trouveraient'],
    subjonctif_present: ['trouve','trouves','trouve','trouvions','trouviez','trouvent'],
  },
  {
    infinitive: 'donner', english: 'to give',
    present: ['donne','donnes','donne','donnons','donnez','donnent'],
    imparfait: ['donnais','donnais','donnait','donnions','donniez','donnaient'],
    passe_compose: ['ai donné','as donné','a donné','avons donné','avez donné','ont donné'],
    futur_simple: ['donnerai','donneras','donnera','donnerons','donnerez','donneront'],
    conditionnel_present: ['donnerais','donnerais','donnerait','donnerions','donneriez','donneraient'],
    subjonctif_present: ['donne','donnes','donne','donnions','donniez','donnent'],
  },
  {
    infinitive: 'parler', english: 'to speak',
    present: ['parle','parles','parle','parlons','parlez','parlent'],
    imparfait: ['parlais','parlais','parlait','parlions','parliez','parlaient'],
    passe_compose: ['ai parlé','as parlé','a parlé','avons parlé','avez parlé','ont parlé'],
    futur_simple: ['parlerai','parleras','parlera','parlerons','parlerez','parleront'],
    conditionnel_present: ['parlerais','parlerais','parlerait','parlerions','parleriez','parleraient'],
    subjonctif_present: ['parle','parles','parle','parlions','parliez','parlent'],
  },
  {
    infinitive: 'aimer', english: 'to love/like',
    present: ['aime','aimes','aime','aimons','aimez','aiment'],
    imparfait: ['aimais','aimais','aimait','aimions','aimiez','aimaient'],
    passe_compose: ['ai aimé','as aimé','a aimé','avons aimé','avez aimé','ont aimé'],
    futur_simple: ['aimerai','aimeras','aimera','aimerons','aimerez','aimeront'],
    conditionnel_present: ['aimerais','aimerais','aimerait','aimerions','aimeriez','aimeraient'],
    subjonctif_present: ['aime','aimes','aime','aimions','aimiez','aiment'],
  },
  {
    infinitive: 'passer', english: 'to pass/spend',
    present: ['passe','passes','passe','passons','passez','passent'],
    imparfait: ['passais','passais','passait','passions','passiez','passaient'],
    passe_compose: ['ai passé','as passé','a passé','avons passé','avez passé','ont passé'],
    futur_simple: ['passerai','passeras','passera','passerons','passerez','passeront'],
    conditionnel_present: ['passerais','passerais','passerait','passerions','passeriez','passeraient'],
    subjonctif_present: ['passe','passes','passe','passions','passiez','passent'],
  },
  {
    infinitive: 'mettre', english: 'to put',
    present: ['mets','mets','met','mettons','mettez','mettent'],
    imparfait: ['mettais','mettais','mettait','mettions','mettiez','mettaient'],
    passe_compose: ['ai mis','as mis','a mis','avons mis','avez mis','ont mis'],
    futur_simple: ['mettrai','mettras','mettra','mettrons','mettrez','mettront'],
    conditionnel_present: ['mettrais','mettrais','mettrait','mettrions','mettriez','mettraient'],
    subjonctif_present: ['mette','mettes','mette','mettions','mettiez','mettent'],
  },
  {
    infinitive: 'croire', english: 'to believe',
    present: ['crois','crois','croit','croyons','croyez','croient'],
    imparfait: ['croyais','croyais','croyait','croyions','croyiez','croyaient'],
    passe_compose: ['ai cru','as cru','a cru','avons cru','avez cru','ont cru'],
    futur_simple: ['croirai','croiras','croira','croirons','croirez','croiront'],
    conditionnel_present: ['croirais','croirais','croirait','croirions','croiriez','croiraient'],
    subjonctif_present: ['croie','croies','croie','croyions','croyiez','croient'],
  },
  {
    infinitive: 'tenir', english: 'to hold',
    present: ['tiens','tiens','tient','tenons','tenez','tiennent'],
    imparfait: ['tenais','tenais','tenait','tenions','teniez','tenaient'],
    passe_compose: ['ai tenu','as tenu','a tenu','avons tenu','avez tenu','ont tenu'],
    futur_simple: ['tiendrai','tiendras','tiendra','tiendrons','tiendrez','tiendront'],
    conditionnel_present: ['tiendrais','tiendrais','tiendrait','tiendrions','tiendriez','tiendraient'],
    subjonctif_present: ['tienne','tiennes','tienne','tenions','teniez','tiennent'],
  },
  {
    infinitive: 'porter', english: 'to carry/wear',
    present: ['porte','portes','porte','portons','portez','portent'],
    imparfait: ['portais','portais','portait','portions','portiez','portaient'],
    passe_compose: ['ai porté','as porté','a porté','avons porté','avez porté','ont porté'],
    futur_simple: ['porterai','porteras','portera','porterons','porterez','porteront'],
    conditionnel_present: ['porterais','porterais','porterait','porterions','porteriez','porteraient'],
    subjonctif_present: ['porte','portes','porte','portions','portiez','portent'],
  },
  {
    infinitive: 'demander', english: 'to ask',
    present: ['demande','demandes','demande','demandons','demandez','demandent'],
    imparfait: ['demandais','demandais','demandait','demandions','demandiez','demandaient'],
    passe_compose: ['ai demandé','as demandé','a demandé','avons demandé','avez demandé','ont demandé'],
    futur_simple: ['demanderai','demanderas','demandera','demanderons','demanderez','demanderont'],
    conditionnel_present: ['demanderais','demanderais','demanderait','demanderions','demanderiez','demanderaient'],
    subjonctif_present: ['demande','demandes','demande','demandions','demandiez','demandent'],
  },
  {
    infinitive: 'répondre', english: 'to answer',
    present: ['réponds','réponds','répond','répondons','répondez','répondent'],
    imparfait: ['répondais','répondais','répondait','répondions','répondiez','répondaient'],
    passe_compose: ['ai répondu','as répondu','a répondu','avons répondu','avez répondu','ont répondu'],
    futur_simple: ['répondrai','répondras','répondra','répondrons','répondrez','répondront'],
    conditionnel_present: ['répondrais','répondrais','répondrait','répondrions','répondriez','répondraient'],
    subjonctif_present: ['réponde','répondes','réponde','répondions','répondiez','répondent'],
  },
  {
    infinitive: 'entendre', english: 'to hear',
    present: ['entends','entends','entend','entendons','entendez','entendent'],
    imparfait: ['entendais','entendais','entendait','entendions','entendiez','entendaient'],
    passe_compose: ['ai entendu','as entendu','a entendu','avons entendu','avez entendu','ont entendu'],
    futur_simple: ['entendrai','entendras','entendra','entendrons','entendrez','entendront'],
    conditionnel_present: ['entendrais','entendrais','entendrait','entendrions','entendriez','entendraient'],
    subjonctif_present: ['entende','entendes','entende','entendions','entendiez','entendent'],
  },
  {
    infinitive: 'attendre', english: 'to wait',
    present: ['attends','attends','attend','attendons','attendez','attendent'],
    imparfait: ['attendais','attendais','attendait','attendions','attendiez','attendaient'],
    passe_compose: ['ai attendu','as attendu','a attendu','avons attendu','avez attendu','ont attendu'],
    futur_simple: ['attendrai','attendras','attendra','attendrons','attendrez','attendront'],
    conditionnel_present: ['attendrais','attendrais','attendrait','attendrions','attendriez','attendraient'],
    subjonctif_present: ['attende','attendes','attende','attendions','attendiez','attendent'],
  },
  {
    infinitive: 'comprendre', english: 'to understand',
    present: ['comprends','comprends','comprend','comprenons','comprenez','comprennent'],
    imparfait: ['comprenais','comprenais','comprenait','comprenions','compreniez','comprenaient'],
    passe_compose: ['ai compris','as compris','a compris','avons compris','avez compris','ont compris'],
    futur_simple: ['comprendrai','comprendras','comprendra','comprendrons','comprendrez','comprendront'],
    conditionnel_present: ['comprendrais','comprendrais','comprendrait','comprendrions','comprendriez','comprendraient'],
    subjonctif_present: ['comprenne','comprennes','comprenne','comprenions','compreniez','comprennent'],
  },
  {
    infinitive: 'connaître', english: 'to know (a person/place)',
    present: ['connais','connais','connaît','connaissons','connaissez','connaissent'],
    imparfait: ['connaissais','connaissais','connaissait','connaissions','connaissiez','connaissaient'],
    passe_compose: ['ai connu','as connu','a connu','avons connu','avez connu','ont connu'],
    futur_simple: ['connaîtrai','connaîtras','connaîtra','connaîtrons','connaîtrez','connaîtront'],
    conditionnel_present: ['connaîtrais','connaîtrais','connaîtrait','connaîtrions','connaîtriez','connaîtraient'],
    subjonctif_present: ['connaisse','connaisses','connaisse','connaissions','connaissiez','connaissent'],
  },
  {
    infinitive: 'écrire', english: 'to write',
    present: ['écris','écris','écrit','écrivons','écrivez','écrivent'],
    imparfait: ['écrivais','écrivais','écrivait','écrivions','écriviez','écrivaient'],
    passe_compose: ['ai écrit','as écrit','a écrit','avons écrit','avez écrit','ont écrit'],
    futur_simple: ['écrirai','écriras','écrira','écrirons','écrirez','écriront'],
    conditionnel_present: ['écrirais','écrirais','écrirait','écririons','écririez','écriraient'],
    subjonctif_present: ['écrive','écrives','écrive','écrivions','écriviez','écrivent'],
  },
  {
    infinitive: 'lire', english: 'to read',
    present: ['lis','lis','lit','lisons','lisez','lisent'],
    imparfait: ['lisais','lisais','lisait','lisions','lisiez','lisaient'],
    passe_compose: ['ai lu','as lu','a lu','avons lu','avez lu','ont lu'],
    futur_simple: ['lirai','liras','lira','lirons','lirez','liront'],
    conditionnel_present: ['lirais','lirais','lirait','lirions','liriez','liraient'],
    subjonctif_present: ['lise','lises','lise','lisions','lisiez','lisent'],
  },
  {
    infinitive: 'vivre', english: 'to live',
    present: ['vis','vis','vit','vivons','vivez','vivent'],
    imparfait: ['vivais','vivais','vivait','vivions','viviez','vivaient'],
    passe_compose: ['ai vécu','as vécu','a vécu','avons vécu','avez vécu','ont vécu'],
    futur_simple: ['vivrai','vivras','vivra','vivrons','vivrez','vivront'],
    conditionnel_present: ['vivrais','vivrais','vivrait','vivrions','vivriez','vivraient'],
    subjonctif_present: ['vive','vives','vive','vivions','viviez','vivent'],
  },
  {
    infinitive: 'ouvrir', english: 'to open',
    present: ['ouvre','ouvres','ouvre','ouvrons','ouvrez','ouvrent'],
    imparfait: ['ouvrais','ouvrais','ouvrait','ouvrions','ouvriez','ouvraient'],
    passe_compose: ['ai ouvert','as ouvert','a ouvert','avons ouvert','avez ouvert','ont ouvert'],
    futur_simple: ['ouvrirai','ouvriras','ouvrira','ouvrirons','ouvrirez','ouvriront'],
    conditionnel_present: ['ouvrirais','ouvrirais','ouvrirait','ouvririons','ouvririez','ouvriraient'],
    subjonctif_present: ['ouvre','ouvres','ouvre','ouvrions','ouvriez','ouvrent'],
  },
  {
    infinitive: 'fermer', english: 'to close',
    present: ['ferme','fermes','ferme','fermons','fermez','ferment'],
    imparfait: ['fermais','fermais','fermait','fermions','fermiez','fermaient'],
    passe_compose: ['ai fermé','as fermé','a fermé','avons fermé','avez fermé','ont fermé'],
    futur_simple: ['fermerai','fermeras','fermera','fermerons','fermerez','fermeront'],
    conditionnel_present: ['fermerais','fermerais','fermerait','fermerions','fermeriez','fermeraient'],
    subjonctif_present: ['ferme','fermes','ferme','fermions','fermiez','ferment'],
  },
  {
    infinitive: 'partir', english: 'to leave',
    present: ['pars','pars','part','partons','partez','partent'],
    imparfait: ['partais','partais','partait','partions','partiez','partaient'],
    passe_compose: ['suis parti','es parti','est parti','sommes partis','êtes partis','sont partis'],
    futur_simple: ['partirai','partiras','partira','partirons','partirez','partiront'],
    conditionnel_present: ['partirais','partirais','partirait','partirions','partiriez','partiraient'],
    subjonctif_present: ['parte','partes','parte','partions','partiez','partent'],
  },
  {
    infinitive: 'sortir', english: 'to go out',
    present: ['sors','sors','sort','sortons','sortez','sortent'],
    imparfait: ['sortais','sortais','sortait','sortions','sortiez','sortaient'],
    passe_compose: ['suis sorti','es sorti','est sorti','sommes sortis','êtes sortis','sont sortis'],
    futur_simple: ['sortirai','sortiras','sortira','sortirons','sortirez','sortiront'],
    conditionnel_present: ['sortirais','sortirais','sortirait','sortirions','sortiriez','sortiraient'],
    subjonctif_present: ['sorte','sortes','sorte','sortions','sortiez','sortent'],
  },
  {
    infinitive: 'entrer', english: 'to enter',
    present: ['entre','entres','entre','entrons','entrez','entrent'],
    imparfait: ['entrais','entrais','entrait','entrions','entriez','entraient'],
    passe_compose: ['suis entré','es entré','est entré','sommes entrés','êtes entrés','sont entrés'],
    futur_simple: ['entrerai','entreras','entrera','entrerons','entrerez','entreront'],
    conditionnel_present: ['entrerais','entrerais','entrerait','entrerions','entreriez','entreraient'],
    subjonctif_present: ['entre','entres','entre','entrions','entriez','entrent'],
  },
  {
    infinitive: 'monter', english: 'to go up/climb',
    present: ['monte','montes','monte','montons','montez','montent'],
    imparfait: ['montais','montais','montait','montions','montiez','montaient'],
    passe_compose: ['suis monté','es monté','est monté','sommes montés','êtes montés','sont montés'],
    futur_simple: ['monterai','monteras','montera','monterons','monterez','monteront'],
    conditionnel_present: ['monterais','monterais','monterait','monterions','monteriez','monteraient'],
    subjonctif_present: ['monte','montes','monte','montions','montiez','montent'],
  },
  {
    infinitive: 'descendre', english: 'to go down',
    present: ['descends','descends','descend','descendons','descendez','descendent'],
    imparfait: ['descendais','descendais','descendait','descendions','descendiez','descendaient'],
    passe_compose: ['suis descendu','es descendu','est descendu','sommes descendus','êtes descendus','sont descendus'],
    futur_simple: ['descendrai','descendras','descendra','descendrons','descendrez','descendront'],
    conditionnel_present: ['descendrais','descendrais','descendrait','descendrions','descendriez','descendraient'],
    subjonctif_present: ['descende','descendes','descende','descendions','descendiez','descendent'],
  },
  {
    infinitive: 'arriver', english: 'to arrive',
    present: ['arrive','arrives','arrive','arrivons','arrivez','arrivent'],
    imparfait: ['arrivais','arrivais','arrivait','arrivions','arriviez','arrivaient'],
    passe_compose: ['suis arrivé','es arrivé','est arrivé','sommes arrivés','êtes arrivés','sont arrivés'],
    futur_simple: ['arriverai','arriveras','arrivera','arriverons','arriverez','arriveront'],
    conditionnel_present: ['arriverais','arriverais','arriverait','arriverions','arriveriez','arriveraient'],
    subjonctif_present: ['arrive','arrives','arrive','arrivions','arriviez','arrivent'],
  },
  {
    infinitive: 'rester', english: 'to stay',
    present: ['reste','restes','reste','restons','restez','restent'],
    imparfait: ['restais','restais','restait','restions','restiez','restaient'],
    passe_compose: ['suis resté','es resté','est resté','sommes restés','êtes restés','sont restés'],
    futur_simple: ['resterai','resteras','restera','resterons','resterez','resteront'],
    conditionnel_present: ['resterais','resterais','resterait','resterions','resteriez','resteraient'],
    subjonctif_present: ['reste','restes','reste','restions','restiez','restent'],
  },
  {
    infinitive: 'retourner', english: 'to return',
    present: ['retourne','retournes','retourne','retournons','retournez','retournent'],
    imparfait: ['retournais','retournais','retournait','retournions','retourniez','retournaient'],
    passe_compose: ['suis retourné','es retourné','est retourné','sommes retournés','êtes retournés','sont retournés'],
    futur_simple: ['retournerai','retourneras','retournera','retournerons','retournerez','retourneront'],
    conditionnel_present: ['retournerais','retournerais','retournerait','retournerions','retourneriez','retourneraient'],
    subjonctif_present: ['retourne','retournes','retourne','retournions','retourniez','retournent'],
  },
  {
    infinitive: 'tomber', english: 'to fall',
    present: ['tombe','tombes','tombe','tombons','tombez','tombent'],
    imparfait: ['tombais','tombais','tombait','tombions','tombiez','tombaient'],
    passe_compose: ['suis tombé','es tombé','est tombé','sommes tombés','êtes tombés','sont tombés'],
    futur_simple: ['tomberai','tomberas','tombera','tomberons','tomberez','tomberont'],
    conditionnel_present: ['tomberais','tomberais','tomberait','tomberions','tomberiez','tomberaient'],
    subjonctif_present: ['tombe','tombes','tombe','tombions','tombiez','tombent'],
  },
  {
    infinitive: 'naître', english: 'to be born',
    present: ['nais','nais','naît','naissons','naissez','naissent'],
    imparfait: ['naissais','naissais','naissait','naissions','naissiez','naissaient'],
    passe_compose: ['suis né','es né','est né','sommes nés','êtes nés','sont nés'],
    futur_simple: ['naîtrai','naîtras','naîtra','naîtrons','naîtrez','naîtront'],
    conditionnel_present: ['naîtrais','naîtrais','naîtrait','naîtrions','naîtriez','naîtraient'],
    subjonctif_present: ['naisse','naisses','naisse','naissions','naissiez','naissent'],
  },
  {
    infinitive: 'mourir', english: 'to die',
    present: ['meurs','meurs','meurt','mourons','mourez','meurent'],
    imparfait: ['mourais','mourais','mourait','mourions','mouriez','mouraient'],
    passe_compose: ['suis mort','es mort','est mort','sommes morts','êtes morts','sont morts'],
    futur_simple: ['mourrai','mourras','mourra','mourrons','mourrez','mourront'],
    conditionnel_present: ['mourrais','mourrais','mourrait','mourrions','mourriez','mourraient'],
    subjonctif_present: ['meure','meures','meure','mourions','mouriez','meurent'],
  },
  {
    infinitive: 'courir', english: 'to run',
    present: ['cours','cours','court','courons','courez','courent'],
    imparfait: ['courais','courais','courait','courions','couriez','couraient'],
    passe_compose: ['ai couru','as couru','a couru','avons couru','avez couru','ont couru'],
    futur_simple: ['courrai','courras','courra','courrons','courrez','courront'],
    conditionnel_present: ['courrais','courrais','courrait','courrions','courriez','courraient'],
    subjonctif_present: ['coure','coures','coure','courions','couriez','courent'],
  },
  {
    infinitive: 'suivre', english: 'to follow',
    present: ['suis','suis','suit','suivons','suivez','suivent'],
    imparfait: ['suivais','suivais','suivait','suivions','suiviez','suivaient'],
    passe_compose: ['ai suivi','as suivi','a suivi','avons suivi','avez suivi','ont suivi'],
    futur_simple: ['suivrai','suivras','suivra','suivrons','suivrez','suivront'],
    conditionnel_present: ['suivrais','suivrais','suivrait','suivrions','suivriez','suivraient'],
    subjonctif_present: ['suive','suives','suive','suivions','suiviez','suivent'],
  },
  {
    infinitive: 'perdre', english: 'to lose',
    present: ['perds','perds','perd','perdons','perdez','perdent'],
    imparfait: ['perdais','perdais','perdait','perdions','perdiez','perdaient'],
    passe_compose: ['ai perdu','as perdu','a perdu','avons perdu','avez perdu','ont perdu'],
    futur_simple: ['perdrai','perdras','perdra','perdrons','perdrez','perdront'],
    conditionnel_present: ['perdrais','perdrais','perdrait','perdrions','perdriez','perdraient'],
    subjonctif_present: ['perde','perdes','perde','perdions','perdiez','perdent'],
  },
  {
    infinitive: 'sentir', english: 'to feel/smell',
    present: ['sens','sens','sent','sentons','sentez','sentent'],
    imparfait: ['sentais','sentais','sentait','sentions','sentiez','sentaient'],
    passe_compose: ['ai senti','as senti','a senti','avons senti','avez senti','ont senti'],
    futur_simple: ['sentirai','sentiras','sentira','sentirons','sentirez','sentiront'],
    conditionnel_present: ['sentirais','sentirais','sentirait','sentirions','sentiriez','sentiraient'],
    subjonctif_present: ['sente','sentes','sente','sentions','sentiez','sentent'],
  },
  {
    infinitive: 'servir', english: 'to serve',
    present: ['sers','sers','sert','servons','servez','servent'],
    imparfait: ['servais','servais','servait','servions','serviez','servaient'],
    passe_compose: ['ai servi','as servi','a servi','avons servi','avez servi','ont servi'],
    futur_simple: ['servirai','serviras','servira','servirons','servirez','serviront'],
    conditionnel_present: ['servirais','servirais','servirait','servirions','serviriez','serviraient'],
    subjonctif_present: ['serve','serves','serve','servions','serviez','servent'],
  },
  {
    infinitive: 'dormir', english: 'to sleep',
    present: ['dors','dors','dort','dormons','dormez','dorment'],
    imparfait: ['dormais','dormais','dormait','dormions','dormiez','dormaient'],
    passe_compose: ['ai dormi','as dormi','a dormi','avons dormi','avez dormi','ont dormi'],
    futur_simple: ['dormirai','dormiras','dormira','dormirons','dormirez','dormiront'],
    conditionnel_present: ['dormirais','dormirais','dormirait','dormirions','dormiriez','dormiraient'],
    subjonctif_present: ['dorme','dormes','dorme','dormions','dormiez','dorment'],
  },
  {
    infinitive: 'offrir', english: 'to offer',
    present: ['offre','offres','offre','offrons','offrez','offrent'],
    imparfait: ['offrais','offrais','offrait','offrions','offriez','offraient'],
    passe_compose: ['ai offert','as offert','a offert','avons offert','avez offert','ont offert'],
    futur_simple: ['offrirai','offriras','offrira','offrirons','offrirez','offriront'],
    conditionnel_present: ['offrirais','offrirais','offrirait','offririons','offririez','offriraient'],
    subjonctif_present: ['offre','offres','offre','offrions','offriez','offrent'],
  },
  {
    infinitive: 'souffrir', english: 'to suffer',
    present: ['souffre','souffres','souffre','souffrons','souffrez','souffrent'],
    imparfait: ['souffrais','souffrais','souffrait','souffrions','souffriez','souffraient'],
    passe_compose: ['ai souffert','as souffert','a souffert','avons souffert','avez souffert','ont souffert'],
    futur_simple: ['souffrirai','souffriras','souffrira','souffrirons','souffrirez','souffriront'],
    conditionnel_present: ['souffrirais','souffrirais','souffrirait','souffririons','souffririez','souffriraient'],
    subjonctif_present: ['souffre','souffres','souffre','souffrions','souffriez','souffrent'],
  },
  {
    infinitive: 'recevoir', english: 'to receive',
    present: ['reçois','reçois','reçoit','recevons','recevez','reçoivent'],
    imparfait: ['recevais','recevais','recevait','recevions','receviez','recevaient'],
    passe_compose: ['ai reçu','as reçu','a reçu','avons reçu','avez reçu','ont reçu'],
    futur_simple: ['recevrai','recevras','recevra','recevrons','recevrez','recevront'],
    conditionnel_present: ['recevrais','recevrais','recevrait','recevrions','recevriez','recevraient'],
    subjonctif_present: ['reçoive','reçoives','reçoive','recevions','receviez','reçoivent'],
  },
  {
    infinitive: 'apercevoir', english: 'to notice/perceive',
    present: ['aperçois','aperçois','aperçoit','apercevons','apercevez','aperçoivent'],
    imparfait: ['apercevais','apercevais','apercevait','apercevions','aperceviez','apercevaient'],
    passe_compose: ['ai aperçu','as aperçu','a aperçu','avons aperçu','avez aperçu','ont aperçu'],
    futur_simple: ['apercevrai','apercevras','apercevra','apercevrons','apercevrez','apercevront'],
    conditionnel_present: ['apercevrais','apercevrais','apercevrait','apercevrions','apercevriez','apercevraient'],
    subjonctif_present: ['aperçoive','aperçoives','aperçoive','apercevions','aperceviez','aperçoivent'],
  },
  {
    infinitive: 'concevoir', english: 'to conceive/design',
    present: ['conçois','conçois','conçoit','concevons','concevez','conçoivent'],
    imparfait: ['concevais','concevais','concevait','concevions','conceviez','concevaient'],
    passe_compose: ['ai conçu','as conçu','a conçu','avons conçu','avez conçu','ont conçu'],
    futur_simple: ['concevrai','concevras','concevra','concevrons','concevrez','concevront'],
    conditionnel_present: ['concevrais','concevrais','concevrait','concevrions','concevriez','concevraient'],
    subjonctif_present: ['conçoive','conçoives','conçoive','concevions','conceviez','conçoivent'],
  },
  {
    infinitive: 'devenir', english: 'to become',
    present: ['deviens','deviens','devient','devenons','devenez','deviennent'],
    imparfait: ['devenais','devenais','devenait','devenions','deveniez','devenaient'],
    passe_compose: ['suis devenu','es devenu','est devenu','sommes devenus','êtes devenus','sont devenus'],
    futur_simple: ['deviendrai','deviendras','deviendra','deviendrons','deviendrez','deviendront'],
    conditionnel_present: ['deviendrais','deviendrais','deviendrait','deviendrions','deviendriez','deviendraient'],
    subjonctif_present: ['devienne','deviennes','devienne','devenions','deveniez','deviennent'],
  },
  {
    infinitive: 'revenir', english: 'to come back',
    present: ['reviens','reviens','revient','revenons','revenez','reviennent'],
    imparfait: ['revenais','revenais','revenait','revenions','reveniez','revenaient'],
    passe_compose: ['suis revenu','es revenu','est revenu','sommes revenus','êtes revenus','sont revenus'],
    futur_simple: ['reviendrai','reviendras','reviendra','reviendrons','reviendrez','reviendront'],
    conditionnel_present: ['reviendrais','reviendrais','reviendrait','reviendrions','reviendriez','reviendraient'],
    subjonctif_present: ['revienne','reviennes','revienne','revenions','reveniez','reviennent'],
  },
  {
    infinitive: 'intervenir', english: 'to intervene',
    present: ['interviens','interviens','intervient','intervenons','intervenez','interviennent'],
    imparfait: ['intervenais','intervenais','intervenait','intervenions','interveniez','intervenaient'],
    passe_compose: ['suis intervenu','es intervenu','est intervenu','sommes intervenus','êtes intervenus','sont intervenus'],
    futur_simple: ['interviendrai','interviendras','interviendra','interviendrons','interviendrez','interviendront'],
    conditionnel_present: ['interviendrais','interviendrais','interviendrait','interviendrions','interviendriez','interviendraient'],
    subjonctif_present: ['intervienne','interviennes','intervienne','intervenions','interveniez','interviennent'],
  },
  {
    infinitive: 'prévenir', english: 'to warn/prevent',
    present: ['préviens','préviens','prévient','prévenons','prévenez','préviennent'],
    imparfait: ['prévenais','prévenais','prévenait','prévenions','préveniez','prévenaient'],
    passe_compose: ['ai prévenu','as prévenu','a prévenu','avons prévenu','avez prévenu','ont prévenu'],
    futur_simple: ['préviendrai','préviendras','préviendra','préviendrons','préviendrez','préviendront'],
    conditionnel_present: ['préviendrais','préviendrais','préviendrait','préviendrions','préviendriez','préviendraient'],
    subjonctif_present: ['prévienne','préviennes','prévienne','prévenions','préveniez','préviennent'],
  },
  {
    infinitive: 'maintenir', english: 'to maintain',
    present: ['maintiens','maintiens','maintient','maintenons','maintenez','maintiennent'],
    imparfait: ['maintenais','maintenais','maintenait','maintenions','mainteniez','maintenaient'],
    passe_compose: ['ai maintenu','as maintenu','a maintenu','avons maintenu','avez maintenu','ont maintenu'],
    futur_simple: ['maintiendrai','maintiendras','maintiendra','maintiendrons','maintiendrez','maintiendront'],
    conditionnel_present: ['maintiendrais','maintiendrais','maintiendrait','maintiendrions','maintiendriez','maintiendraient'],
    subjonctif_present: ['maintienne','maintiennes','maintienne','maintenions','mainteniez','maintiennent'],
  },
  {
    infinitive: 'obtenir', english: 'to obtain',
    present: ['obtiens','obtiens','obtient','obtenons','obtenez','obtiennent'],
    imparfait: ['obtenais','obtenais','obtenait','obtenions','obteniez','obtenaient'],
    passe_compose: ['ai obtenu','as obtenu','a obtenu','avons obtenu','avez obtenu','ont obtenu'],
    futur_simple: ['obtiendrai','obtiendras','obtiendra','obtiendrons','obtiendrez','obtiendront'],
    conditionnel_present: ['obtiendrais','obtiendrais','obtiendrait','obtiendrions','obtiendriez','obtiendraient'],
    subjonctif_present: ['obtienne','obtiennes','obtienne','obtenions','obteniez','obtiennent'],
  },
  {
    infinitive: 'contenir', english: 'to contain',
    present: ['contiens','contiens','contient','contenons','contenez','contiennent'],
    imparfait: ['contenais','contenais','contenait','contenions','conteniez','contenaient'],
    passe_compose: ['ai contenu','as contenu','a contenu','avons contenu','avez contenu','ont contenu'],
    futur_simple: ['contiendrai','contiendras','contiendra','contiendrons','contiendrez','contiendront'],
    conditionnel_present: ['contiendrais','contiendrais','contiendrait','contiendrions','contiendriez','contiendraient'],
    subjonctif_present: ['contienne','contiennes','contienne','contenions','conteniez','contiennent'],
  },
  {
    infinitive: 'retenir', english: 'to retain/remember',
    present: ['retiens','retiens','retient','retenons','retenez','retiennent'],
    imparfait: ['retenais','retenais','retenait','retenions','reteniez','retenaient'],
    passe_compose: ['ai retenu','as retenu','a retenu','avons retenu','avez retenu','ont retenu'],
    futur_simple: ['retiendrai','retiendras','retiendra','retiendrons','retiendrez','retiendront'],
    conditionnel_present: ['retiendrais','retiendrais','retiendrait','retiendrions','retiendriez','retiendraient'],
    subjonctif_present: ['retienne','retiennes','retienne','retenions','reteniez','retiennent'],
  },
  {
    infinitive: 'appartenir', english: 'to belong',
    present: ['appartiens','appartiens','appartient','appartenons','appartenez','appartiennent'],
    imparfait: ['appartenais','appartenais','appartenait','appartenions','apparteniez','appartenaient'],
    passe_compose: ['ai appartenu','as appartenu','a appartenu','avons appartenu','avez appartenu','ont appartenu'],
    futur_simple: ['appartiendrai','appartiendras','appartiendra','appartiendrons','appartiendrez','appartiendront'],
    conditionnel_present: ['appartiendrais','appartiendrais','appartiendrait','appartiendrions','appartiendriez','appartiendraient'],
    subjonctif_present: ['appartienne','appartiennes','appartienne','appartenions','apparteniez','appartiennent'],
  },
  {
    infinitive: 'apprendre', english: 'to learn',
    present: ['apprends','apprends','apprend','apprenons','apprenez','apprennent'],
    imparfait: ['apprenais','apprenais','apprenait','apprenions','appreniez','apprenaient'],
    passe_compose: ['ai appris','as appris','a appris','avons appris','avez appris','ont appris'],
    futur_simple: ['apprendrai','apprendras','apprendra','apprendrons','apprendrez','apprendront'],
    conditionnel_present: ['apprendrais','apprendrais','apprendrait','apprendrions','apprendriez','apprendraient'],
    subjonctif_present: ['apprenne','apprennes','apprenne','apprenions','appreniez','apprennent'],
  },
  {
    infinitive: 'entreprendre', english: 'to undertake',
    present: ['entreprends','entreprends','entreprend','entreprenons','entreprenez','entreprennent'],
    imparfait: ['entreprenais','entreprenais','entreprenait','entreprenions','entrepreniez','entreprenaient'],
    passe_compose: ['ai entrepris','as entrepris','a entrepris','avons entrepris','avez entrepris','ont entrepris'],
    futur_simple: ['entreprendrai','entreprendras','entreprendra','entreprendrons','entreprendrez','entreprendront'],
    conditionnel_present: ['entreprendrais','entreprendrais','entreprendrait','entreprendrions','entreprendriez','entreprendraient'],
    subjonctif_present: ['entreprenne','entreprennes','entreprenne','entreprenions','entrepreniez','entreprennent'],
  },
  {
    infinitive: 'reprendre', english: 'to resume/take back',
    present: ['reprends','reprends','reprend','reprenons','reprenez','reprennent'],
    imparfait: ['reprenais','reprenais','reprenait','reprenions','repreniez','reprenaient'],
    passe_compose: ['ai repris','as repris','a repris','avons repris','avez repris','ont repris'],
    futur_simple: ['reprendrai','reprendras','reprendra','reprendrons','reprendrez','reprendront'],
    conditionnel_present: ['reprendrais','reprendrais','reprendrait','reprendrions','reprendriez','reprendraient'],
    subjonctif_present: ['reprenne','reprennes','reprenne','reprenions','repreniez','reprennent'],
  },
  {
    infinitive: 'boire', english: 'to drink',
    present: ['bois','bois','boit','buvons','buvez','boivent'],
    imparfait: ['buvais','buvais','buvait','buvions','buviez','buvaient'],
    passe_compose: ['ai bu','as bu','a bu','avons bu','avez bu','ont bu'],
    futur_simple: ['boirai','boiras','boira','boirons','boirez','boiront'],
    conditionnel_present: ['boirais','boirais','boirait','boirions','boiriez','boiraient'],
    subjonctif_present: ['boive','boives','boive','buvions','buviez','boivent'],
  },
  {
    infinitive: 'conduire', english: 'to drive/lead',
    present: ['conduis','conduis','conduit','conduisons','conduisez','conduisent'],
    imparfait: ['conduisais','conduisais','conduisait','conduisions','conduisiez','conduisaient'],
    passe_compose: ['ai conduit','as conduit','a conduit','avons conduit','avez conduit','ont conduit'],
    futur_simple: ['conduirai','conduiras','conduira','conduirons','conduirez','conduiront'],
    conditionnel_present: ['conduirais','conduirais','conduirait','conduirions','conduiriez','conduiraient'],
    subjonctif_present: ['conduise','conduises','conduise','conduisions','conduisiez','conduisent'],
  },
  {
    infinitive: 'construire', english: 'to build',
    present: ['construis','construis','construit','construisons','construisez','construisent'],
    imparfait: ['construisais','construisais','construisait','construisions','construisiez','construisaient'],
    passe_compose: ['ai construit','as construit','a construit','avons construit','avez construit','ont construit'],
    futur_simple: ['construirai','construiras','construira','construirons','construirez','construiront'],
    conditionnel_present: ['construirais','construirais','construirait','construirions','construiriez','construiraient'],
    subjonctif_present: ['construise','construises','construise','construisions','construisiez','construisent'],
  },
  {
    infinitive: 'détruire', english: 'to destroy',
    present: ['détruis','détruis','détruit','détruisons','détruisez','détruisent'],
    imparfait: ['détruisais','détruisais','détruisait','détruisions','détruisiez','détruisaient'],
    passe_compose: ['ai détruit','as détruit','a détruit','avons détruit','avez détruit','ont détruit'],
    futur_simple: ['détruirai','détruiras','détruira','détruirons','détruirez','détruiront'],
    conditionnel_present: ['détruirais','détruirais','détruirait','détruirions','détruiriez','détruiraient'],
    subjonctif_present: ['détruise','détruises','détruise','détruisions','détruisiez','détruisent'],
  },
  {
    infinitive: 'produire', english: 'to produce',
    present: ['produis','produis','produit','produisons','produisez','produisent'],
    imparfait: ['produisais','produisais','produisait','produisions','produisiez','produisaient'],
    passe_compose: ['ai produit','as produit','a produit','avons produit','avez produit','ont produit'],
    futur_simple: ['produirai','produiras','produira','produirons','produirez','produiront'],
    conditionnel_present: ['produirais','produirais','produirait','produirions','produiriez','produiraient'],
    subjonctif_present: ['produise','produises','produise','produisions','produisiez','produisent'],
  },
  {
    infinitive: 'réduire', english: 'to reduce',
    present: ['réduis','réduis','réduit','réduisons','réduisez','réduisent'],
    imparfait: ['réduisais','réduisais','réduisait','réduisions','réduisiez','réduisaient'],
    passe_compose: ['ai réduit','as réduit','a réduit','avons réduit','avez réduit','ont réduit'],
    futur_simple: ['réduirai','réduiras','réduira','réduirons','réduirez','réduiront'],
    conditionnel_present: ['réduirais','réduirais','réduirait','réduirions','réduiriez','réduiraient'],
    subjonctif_present: ['réduise','réduises','réduise','réduisions','réduisiez','réduisent'],
  },
  {
    infinitive: 'traduire', english: 'to translate',
    present: ['traduis','traduis','traduit','traduisons','traduisez','traduisent'],
    imparfait: ['traduisais','traduisais','traduisait','traduisions','traduisiez','traduisaient'],
    passe_compose: ['ai traduit','as traduit','a traduit','avons traduit','avez traduit','ont traduit'],
    futur_simple: ['traduirai','traduiras','traduira','traduirons','traduirez','traduiront'],
    conditionnel_present: ['traduirais','traduirais','traduirait','traduirions','traduiriez','traduiraient'],
    subjonctif_present: ['traduise','traduises','traduise','traduisions','traduisiez','traduisent'],
  },
  {
    infinitive: 'plaire', english: 'to please',
    present: ['plais','plais','plaît','plaisons','plaisez','plaisent'],
    imparfait: ['plaisais','plaisais','plaisait','plaisions','plaisiez','plaisaient'],
    passe_compose: ['ai plu','as plu','a plu','avons plu','avez plu','ont plu'],
    futur_simple: ['plairai','plairas','plaira','plairons','plairez','plairont'],
    conditionnel_present: ['plairais','plairais','plairait','plairions','plairiez','plairaient'],
    subjonctif_present: ['plaise','plaises','plaise','plaisions','plaisiez','plaisent'],
  },
  {
    infinitive: 'taire', english: 'to silence/keep quiet',
    present: ['tais','tais','tait','taisons','taisez','taisent'],
    imparfait: ['taisais','taisais','taisait','taisions','taisiez','taisaient'],
    passe_compose: ['ai tu','as tu','a tu','avons tu','avez tu','ont tu'],
    futur_simple: ['tairai','tairas','taira','tairons','tairez','tairont'],
    conditionnel_present: ['tairais','tairais','tairait','tairions','tairiez','tairaient'],
    subjonctif_present: ['taise','taises','taise','taisions','taisiez','taisent'],
  },
  {
    infinitive: 'craindre', english: 'to fear',
    present: ['crains','crains','craint','craignons','craignez','craignent'],
    imparfait: ['craignais','craignais','craignait','craignions','craigniez','craignaient'],
    passe_compose: ['ai craint','as craint','a craint','avons craint','avez craint','ont craint'],
    futur_simple: ['craindrai','craindras','craindra','craindrons','craindrez','craindront'],
    conditionnel_present: ['craindrais','craindrais','craindrait','craindrions','craindriez','craindraient'],
    subjonctif_present: ['craigne','craignes','craigne','craignions','craigniez','craignent'],
  },
  {
    infinitive: 'peindre', english: 'to paint',
    present: ['peins','peins','peint','peignons','peignez','peignent'],
    imparfait: ['peignais','peignais','peignait','peignions','peigniez','peignaient'],
    passe_compose: ['ai peint','as peint','a peint','avons peint','avez peint','ont peint'],
    futur_simple: ['peindrai','peindras','peindra','peindrons','peindrez','peindront'],
    conditionnel_present: ['peindrais','peindrais','peindrait','peindrions','peindriez','peindraient'],
    subjonctif_present: ['peigne','peignes','peigne','peignions','peigniez','peignent'],
  },
  {
    infinitive: 'joindre', english: 'to join',
    present: ['joins','joins','joint','joignons','joignez','joignent'],
    imparfait: ['joignais','joignais','joignait','joignions','joigniez','joignaient'],
    passe_compose: ['ai joint','as joint','a joint','avons joint','avez joint','ont joint'],
    futur_simple: ['joindrai','joindras','joindra','joindrons','joindrez','joindront'],
    conditionnel_present: ['joindrais','joindrais','joindrait','joindrions','joindriez','joindraient'],
    subjonctif_present: ['joigne','joignes','joigne','joignions','joigniez','joignent'],
  },
  {
    infinitive: 'atteindre', english: 'to reach/attain',
    present: ['atteins','atteins','atteint','atteignons','atteignez','atteignent'],
    imparfait: ['atteignais','atteignais','atteignait','atteignions','atteigniez','atteignaient'],
    passe_compose: ['ai atteint','as atteint','a atteint','avons atteint','avez atteint','ont atteint'],
    futur_simple: ['atteindrai','atteindras','atteindra','atteindrons','atteindrez','atteindront'],
    conditionnel_present: ['atteindrais','atteindrais','atteindrait','atteindrions','atteindriez','atteindraient'],
    subjonctif_present: ['atteigne','atteignes','atteigne','atteignions','atteigniez','atteignent'],
  },
  {
    infinitive: 'éteindre', english: 'to extinguish/turn off',
    present: ['éteins','éteins','éteint','éteignons','éteignez','éteignent'],
    imparfait: ['éteignais','éteignais','éteignait','éteignions','éteigniez','éteignaient'],
    passe_compose: ['ai éteint','as éteint','a éteint','avons éteint','avez éteint','ont éteint'],
    futur_simple: ['éteindrai','éteindras','éteindra','éteindrons','éteindrez','éteindront'],
    conditionnel_present: ['éteindrais','éteindrais','éteindrait','éteindrions','éteindriez','éteindraient'],
    subjonctif_present: ['éteigne','éteignes','éteigne','éteignions','éteigniez','éteignent'],
  },
  {
    infinitive: 'vaincre', english: 'to conquer/defeat',
    present: ['vaincs','vaincs','vainc','vainquons','vainquez','vainquent'],
    imparfait: ['vainquais','vainquais','vainquait','vainquions','vainquiez','vainquaient'],
    passe_compose: ['ai vaincu','as vaincu','a vaincu','avons vaincu','avez vaincu','ont vaincu'],
    futur_simple: ['vaincrai','vaincras','vaincra','vaincrons','vaincrez','vaincront'],
    conditionnel_present: ['vaincrais','vaincrais','vaincrait','vaincrions','vaincriez','vaincraient'],
    subjonctif_present: ['vainque','vainques','vainque','vainquions','vainquiez','vainquent'],
  },
  {
    infinitive: 'convaincre', english: 'to convince',
    present: ['convaincs','convaincs','convainc','convainquons','convainquez','convainquent'],
    imparfait: ['convainquais','convainquais','convainquait','convainquions','convainquiez','convainquaient'],
    passe_compose: ['ai convaincu','as convaincu','a convaincu','avons convaincu','avez convaincu','ont convaincu'],
    futur_simple: ['convaincrai','convaincras','convaincra','convaincrons','convaincrez','convaincront'],
    conditionnel_present: ['convaincrais','convaincrais','convaincrait','convaincrions','convaincriez','convaincraient'],
    subjonctif_present: ['convainque','convainques','convainque','convainquions','convainquiez','convainquent'],
  },
  {
    infinitive: 'résoudre', english: 'to resolve/solve',
    present: ['résous','résous','résout','résolvons','résolvez','résolvent'],
    imparfait: ['résolvais','résolvais','résolvait','résolvions','résolviez','résolvaient'],
    passe_compose: ['ai résolu','as résolu','a résolu','avons résolu','avez résolu','ont résolu'],
    futur_simple: ['résoudrai','résoudras','résoudra','résoudrons','résoudrez','résoudront'],
    conditionnel_present: ['résoudrais','résoudrais','résoudrait','résoudrions','résoudriez','résoudraient'],
    subjonctif_present: ['résolve','résolves','résolve','résolvions','résolviez','résolvent'],
  },
  {
    infinitive: 'absoudre', english: 'to absolve',
    present: ['absous','absous','absout','absolvons','absolvez','absolvent'],
    imparfait: ['absolvais','absolvais','absolvait','absolvions','absolviez','absolvaient'],
    passe_compose: ['ai absous','as absous','a absous','avons absous','avez absous','ont absous'],
    futur_simple: ['absoudrai','absoudras','absoudra','absoudrons','absoudrez','absoudront'],
    conditionnel_present: ['absoudrais','absoudrais','absoudrait','absoudrions','absoudriez','absoudraient'],
    subjonctif_present: ['absolve','absolves','absolve','absolvions','absolviez','absolvent'],
  },
  {
    infinitive: 'finir', english: 'to finish',
    present: ['finis','finis','finit','finissons','finissez','finissent'],
    imparfait: ['finissais','finissais','finissait','finissions','finissiez','finissaient'],
    passe_compose: ['ai fini','as fini','a fini','avons fini','avez fini','ont fini'],
    futur_simple: ['finirai','finiras','finira','finirons','finirez','finiront'],
    conditionnel_present: ['finirais','finirais','finirait','finirions','finiriez','finiraient'],
    subjonctif_present: ['finisse','finisses','finisse','finissions','finissiez','finissent'],
  },
];

// ─── Constants ───────────────────────────────────────────────────────────────
const PERSONS       = ['je','tu','il','nous','vous','ils'];
const PERSON_LABELS = ['je','tu','il/elle','nous','vous','ils/elles'];
const TENSES = [
  'present','imparfait','futur_simple','conditionnel_present',
  'subjonctif_present','passe_simple',
  'participe_present','participe_passe',
  'passe_compose','plus_que_parfait','futur_anterieur',
  'passe_anterieur','subjonctif_passe','conditionnel_passe',
];
const TENSE_LABELS = {
  present: 'Présent',
  imparfait: 'Imparfait',
  futur_simple: 'Futur Simple',
  conditionnel_present: 'Conditionnel Présent',
  subjonctif_present: 'Subjonctif Présent',
  passe_simple: 'Passé Simple',
  participe_present: 'Participe Présent',
  participe_passe: 'Participe Passé',
  passe_compose: 'Passé Composé',
  plus_que_parfait: 'Plus-que-parfait',
  futur_anterieur: 'Futur Antérieur',
  passe_anterieur: 'Passé Antérieur',
  subjonctif_passe: 'Subjonctif Passé',
  conditionnel_passe: 'Conditionnel Passé',
};

// Tenses that are "original" (built from stem, no auxiliary)
const ORIGINAL_TENSES = new Set([
  'present','imparfait','futur_simple','conditionnel_present',
  'subjonctif_present','passe_simple','participe_present','participe_passe',
]);
// Tenses that are "compound" (auxiliary + participe passé)
// (used for picker UI and auxiliary detection)

const AUXILIARIES = ['être','avoir'];

// FIX #3: module-level constant so it's never duplicated
const COMPOUND_TENSES = [
  'passe_compose','plus_que_parfait','futur_anterieur',
  'passe_anterieur','subjonctif_passe','conditionnel_passe',
];

// Être auxiliary forms keyed by tense — used for correct auxiliary detection
const ETRE_FORMS = {
  passe_compose:     ['suis','es','est','sommes','êtes','sont'],
  plus_que_parfait:  ['étais','étais','était','étions','étiez','étaient'],
  futur_anterieur:   ['serai','seras','sera','serons','serez','seront'],
  passe_anterieur:   ['fus','fus','fut','fûmes','fûtes','furent'],
  subjonctif_passe:  ['sois','sois','soit','soyons','soyez','soient'],
  conditionnel_passe:['serais','serais','serait','serions','seriez','seraient'],
};

const SRS_KEY      = 'frenchSRS_v2';
const HISTORY_KEY  = 'frenchSRS_history';
const MASTERY_WEIGHT   = 0.25;
const MASTERY_MIN_SEEN = 3;

// Default tenses shown on first load (the 6 main ones)
const DEFAULT_TENSES = ['present','imparfait','passe_compose','futur_simple','conditionnel_present','subjonctif_present'];

// ─── State ───────────────────────────────────────────────────────────────────
let verbs        = [];
let customVerbs  = [];
let srs          = {};
let mistakeHistory = []; // persisted across sessions
let lastMicroFocused = null;
let advanceTimer = null; // for manual-advance mode

let session = {
  items: [], queue: [], wrongBuffer: [], current: null,
  qCount: 0, qLimit: 0, correctCount: 0,
  timeLimit: 0, timerHandle: null, timerStart: 0,
  mode: 'byTense', selectedTenses: [...DEFAULT_TENSES],
  verb: '', chunkSize: 15,
  strictAccents: true, practiceType: 'write',
  autoAdvance: false,
  submitted: false,
  mistakes: [],
  lastSessionOpts: null,
};

// ─── Accent stripping ────────────────────────────────────────────────────────
const ACCENT_MAP = {
  'é':'e','è':'e','ê':'e','ë':'e',
  'à':'a','â':'a','ä':'a',
  'ù':'u','û':'u','ü':'u',
  'î':'i','ï':'i',
  'ô':'o','œ':'oe',
  'ç':'c','æ':'ae',
};

function stripAccents(s) {
  return s.replace(/[éèêëàâäùûüîïôœçæ]/g, ch => ACCENT_MAP[ch] || ch);
}

// ─── Normalize ───────────────────────────────────────────────────────────────
function normalize(s) {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

// ─── SRS helpers ─────────────────────────────────────────────────────────────
function srsKey(infinitive, tense, person) {
  return `${infinitive}|${tense}|${person}`;
}

function srsGet(infinitive, tense, person) {
  const k = srsKey(infinitive, tense, person);
  if (!srs[k]) srs[k] = { weight: 1.0, times_seen: 0, times_correct: 0, streak: 0, last_seen: 0 };
  return srs[k];
}

function srsUpdate(infinitive, tense, person, result) {
  // result: 'correct' | 'partial' | 'wrong'
  const item = srsGet(infinitive, tense, person);
  item.times_seen++;
  item.last_seen = Date.now();
  if (result === 'correct') {
    item.times_correct++;
    item.streak++;
    item.weight = Math.max(0.2, item.weight * 0.85);
  } else if (result === 'partial') {
    // FIX #11: fuzzy accent match — small penalty, no streak break
    item.times_correct++;
    item.weight = Math.max(0.2, item.weight * 1.1);
  } else {
    item.streak = 0;
    item.weight = Math.min(10, item.weight * 1.4);
  }
  saveSRS();
}

function isMastered(infinitive, tense, person) {
  const item = srsGet(infinitive, tense, person);
  return item.weight <= MASTERY_WEIGHT && item.times_seen >= MASTERY_MIN_SEEN;
}

function saveSRS() {
  try { localStorage.setItem(SRS_KEY, JSON.stringify(srs)); } catch(_) {}
}

function loadSRS() {
  try {
    const raw = localStorage.getItem(SRS_KEY);
    if (raw) srs = JSON.parse(raw);
  } catch(_) { srs = {}; }
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) mistakeHistory = JSON.parse(raw);
  } catch(_) { mistakeHistory = []; }
}

function saveMistakeHistory() {
  // Keep last 500 mistakes
  if (mistakeHistory.length > 500) mistakeHistory = mistakeHistory.slice(-500);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(mistakeHistory)); } catch(_) {}
}

// ─── Fisher-Yates shuffle (FIX #24) ─────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Weighted random selection ───────────────────────────────────────────────
function weightedPick(items) {
  const weights = items.map(it => srsGet(it.infinitive, it.tense, it.person).weight);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ─── Build item list ─────────────────────────────────────────────────────────
function buildItems(opts) {
  let pool = [];
  const tenseList = opts.mode === 'auxiliary'
    ? ['present','imparfait','passe_compose','futur_simple','conditionnel_present','subjonctif_present']
    : (opts.selectedTenses && opts.selectedTenses.length > 0 ? opts.selectedTenses : TENSES);

  const addVerb = (v) => {
    tenseList.forEach(t => {
      if (!v[t]) return;
      // participe_present and participe_passe are single-form, stored as [form] array or string
      PERSONS.forEach((p, idx) => {
        const ans = Array.isArray(v[t]) ? v[t][idx] : null;
        if (ans) pool.push({ infinitive: v.infinitive, english: v.english || '', tense: t, person: p, answer: ans });
      });
    });
  };

  if (opts.mode === 'auxiliary') {
    verbs.filter(v => AUXILIARIES.includes(v.infinitive)).forEach(addVerb);
  } else if (opts.mode === 'byVerb' && opts.verb) {
    const v = verbs.find(x => x.infinitive === opts.verb);
    if (v) addVerb(v);
  } else if (opts.mode === 'byTense') {
    // Sort: auxiliaries first, then by SRS weight descending (weakest first in chunk)
    let sorted = [...verbs].sort((a, b) => {
      const aA = AUXILIARIES.includes(a.infinitive) ? -1 : 0;
      const bA = AUXILIARIES.includes(b.infinitive) ? -1 : 0;
      return aA - bA;
    });
    sorted.slice(0, opts.chunkSize).forEach(v => {
      tenseList.forEach(t => {
        if (!v[t]) return;
        PERSONS.forEach((p, idx) => {
          const ans = Array.isArray(v[t]) ? v[t][idx] : null;
          if (ans) pool.push({ infinitive: v.infinitive, english: v.english || '', tense: t, person: p, answer: ans });
        });
      });
    });
  } else {
    verbs.forEach(addVerb);
  }
  return pool;
}

// ─── Build 10-weakest item list (FIX: quick session) ─────────────────────────
function buildWeakestItems(n) {
  const all = [];
  verbs.forEach(v => {
    TENSES.forEach(t => {
      if (!v[t]) return;
      PERSONS.forEach((p, idx) => {
        const ans = v[t][idx];
        if (!ans) return;
        const data = srsGet(v.infinitive, t, p);
        all.push({ infinitive: v.infinitive, english: v.english || '', tense: t, person: p, answer: ans, weight: data.weight });
      });
    });
  });
  all.sort((a, b) => b.weight - a.weight);
  return all.slice(0, n);
}

// ─── MCQ distractors: same tense only (FIX #2) ──────────────────────────────
function buildDistractors(item, count) {
  const all = [];
  verbs.forEach(v => {
    if (!v[item.tense]) return;
    PERSONS.forEach((p, idx) => {
      const a = v[item.tense][idx];
      if (a && a !== item.answer) all.push(a);
    });
  });
  const shuffled = shuffle(all);
  const seen = new Set([item.answer]);
  const result = [];
  for (const a of shuffled) {
    if (!seen.has(a)) { seen.add(a); result.push(a); }
    if (result.length >= count) break;
  }
  return result;
}

// ─── Correct auxiliary detection for any compound tense (FIX #3) ─────────────
function detectAuxiliary(tense, personIdx, answer) {
  if (!COMPOUND_TENSES.includes(tense)) return null;
  const etreForms = ETRE_FORMS[tense];
  if (!etreForms) return 'avoir';
  // Check if the answer starts with the être form for this person
  const etreForm = etreForms[personIdx];
  if (etreForm && answer.toLowerCase().startsWith(etreForm.toLowerCase())) return 'être';
  return 'avoir';
}

// ─── Session control ─────────────────────────────────────────────────────────
function getSelectedTenses() {
  const checked = document.querySelectorAll('#tensePicker input[type=checkbox]:checked');
  return Array.from(checked).map(cb => cb.value);
}

function startSession(overrideItems) {
  const mode          = document.getElementById('selMode').value;
  const selectedTenses= getSelectedTenses();
  const verb          = document.getElementById('selVerb').value;
  const chunkSize     = parseInt(document.getElementById('inChunk').value) || 15;
  const qLimit        = parseInt(document.getElementById('inQLimit').value) || 0;
  const timeLimit     = parseInt(document.getElementById('inTime').value) || 0;
  const strictAccents = document.getElementById('chkAccents').checked;
  const practiceType  = document.getElementById('selPractice').value;
  const autoAdvance   = document.getElementById('chkAutoAdvance').checked;

  if (verbs.length === 0) {
    showToast('No verbs loaded.');
    return;
  }

  if (mode !== 'auxiliary' && mode !== 'micro' && selectedTenses.length === 0) {
    showToast('Please select at least one tense.');
    return;
  }

  const opts = { mode, selectedTenses, verb, chunkSize, qLimit, timeLimit, strictAccents, practiceType, autoAdvance };
  session.lastSessionOpts = opts;

  session.mode = mode;
  session.selectedTenses = selectedTenses;
  session.verb = verb;
  session.chunkSize = chunkSize;
  session.qLimit = qLimit;
  session.timeLimit = timeLimit;
  session.strictAccents = strictAccents;
  session.practiceType = practiceType;
  session.autoAdvance = autoAdvance;
  session.qCount = 0;
  session.correctCount = 0;
  session.wrongBuffer = [];
  session.submitted = false;
  session.mistakes = [];

  session.items = overrideItems || buildItems({ mode, selectedTenses, verb, chunkSize });

  if (session.items.length === 0) {
    showToast('No conjugations found. Check your tense selection and verb data.');
    return;
  }

  session.queue = shuffle([...session.items]);

  if (mode === 'micro') {
    startMicro();
    return;
  }

  showScreen('screenPractice');
  updateProgress();
  nextQuestion();
  startTimer();
}

function startTimer() {
  clearInterval(session.timerHandle);
  const el = document.getElementById('timerDisplay');
  el.textContent = '';
  el.className = '';
  if (!session.timeLimit) return;
  session.timerStart = Date.now();
  session.timerHandle = setInterval(() => {
    const elapsed = Math.floor((Date.now() - session.timerStart) / 1000);
    const remaining = session.timeLimit - elapsed;
    if (remaining <= 0) {
      clearInterval(session.timerHandle);
      el.textContent = 'Time: 0s';
      endSession();
      return;
    }
    el.textContent = `Time: ${remaining}s`;
    el.className = remaining <= 10 ? 'timer-low' : '';
  }, 500);
}

function nextQuestion() {
  if (session.qLimit && session.qCount >= session.qLimit) {
    endSession();
    return;
  }

  session.submitted = false;
  let item;

  // FIX #14: safe wrong-buffer injection — only once per cycle, not consecutive
  if (session.wrongBuffer.length > 0 && session.qCount > 0 && session.qCount % 3 === 0) {
    item = session.wrongBuffer.shift();
  }

  if (!item) {
    if (session.queue.length === 0) session.queue = shuffle([...session.items]);
    item = weightedPick(session.queue);
    const idx = session.queue.indexOf(item);
    if (idx !== -1) session.queue.splice(idx, 1);
  }

  session.current = item;
  renderQuestion(item);
}

function renderQuestion(item) {
  const label       = TENSE_LABELS[item.tense] || item.tense;
  const personIdx   = PERSONS.indexOf(item.person);
  const personLabel = PERSON_LABELS[personIdx] || item.person;
  const mastered    = isMastered(item.infinitive, item.tense, item.person);
  const data        = srsGet(item.infinitive, item.tense, item.person);

  document.getElementById('qInfinitive').textContent = item.infinitive;
  document.getElementById('qEnglish').textContent    = item.english ? `(${item.english})` : '';
  document.getElementById('qTense').textContent      = label;
  document.getElementById('qPerson').textContent     = personLabel;
  document.getElementById('qMastered').textContent   = mastered ? '★ Mastered' : '';
  document.getElementById('qStats').textContent      = `Seen: ${data.times_seen} · Correct: ${data.times_correct} · Streak: ${data.streak}`;

  document.getElementById('feedbackBox').className = 'feedback-box hidden';
  document.getElementById('advanceBar').className  = 'advance-bar hidden';

  // Hide Next buttons
  document.getElementById('btnNext').classList.add('hidden');
  const mcqNR = document.getElementById('mcqNextRow');
  mcqNR.classList.add('hidden');
  mcqNR.classList.remove('visible');

  const input = document.getElementById('answerInput');
  input.value    = '';
  input.disabled = false;

  const btnSubmit = document.getElementById('btnSubmit');
  const btnShow   = document.getElementById('btnShowAnswer');
  btnSubmit.disabled = false;
  btnShow.disabled   = false;

  // Auxiliary hint
  const hint = document.getElementById('auxiliaryHint');
  if (COMPOUND_TENSES.includes(item.tense)) {
    const aux = detectAuxiliary(item.tense, personIdx, item.answer);
    hint.textContent = `Auxiliary: ${aux}`;
    hint.className = 'auxiliary-hint';
  } else {
    hint.textContent = '';
    hint.className = 'hidden';
  }

  if (session.practiceType === 'mcq') {
    renderMCQ(item);
    document.getElementById('writeArea').classList.add('hidden');
    document.getElementById('accentBar').classList.add('hidden');
  } else {
    document.getElementById('mcqOptions').innerHTML = '';
    document.getElementById('mcqOptions').className = 'mcq-options hidden';
    document.getElementById('writeArea').classList.remove('hidden');
    document.getElementById('accentBar').classList.remove('hidden');
    input.focus();
  }
}

function renderMCQ(item) {
  const distractors = buildDistractors(item, 3);
  const options     = shuffle([item.answer, ...distractors]);
  const container   = document.getElementById('mcqOptions');
  container.innerHTML = '';
  container.className = 'mcq-options';

  options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'mcq-btn';
    btn.dataset.answer = opt;
    // FIX #8: keyboard number hint
    const hint = document.createElement('span');
    hint.className = 'kbd-hint';
    hint.textContent = i + 1;
    btn.appendChild(hint);
    btn.appendChild(document.createTextNode(opt));
    btn.addEventListener('click', () => {
      if (session.submitted) return;
      submitAnswer(opt);
    });
    container.appendChild(btn);
  });
}

// ─── Answer submission ────────────────────────────────────────────────────────
function submitAnswer(rawAnswer) {
  // FIX #1: prevent double-submit
  if (session.submitted) return;
  const item = session.current;
  if (!item) return;

  const input = document.getElementById('answerInput');
  const userRaw = rawAnswer !== undefined ? rawAnswer : input.value;
  const userAnswer = normalize(userRaw);
  if (!userAnswer) return;

  session.submitted = true;

  // Disable inputs immediately (FIX #1, #5)
  input.disabled = true;
  document.getElementById('btnSubmit').disabled  = true;
  document.getElementById('btnShowAnswer').disabled = true;

  const correct   = normalize(item.answer);
  const personIdx = PERSONS.indexOf(item.person);

  // FIX #11: check for accent-only difference
  let result;
  if (userAnswer === correct) {
    result = 'correct';
  } else if (!session.strictAccents && stripAccents(userAnswer) === stripAccents(correct)) {
    result = 'partial';
  } else {
    result = 'wrong';
  }

  srsUpdate(item.infinitive, item.tense, item.person, result);
  session.qCount++;
  if (result !== 'wrong') session.correctCount++;
  if (result === 'wrong') {
    session.wrongBuffer.push(item);
    const entry = { infinitive: item.infinitive, tense: item.tense, person: item.person, correct: item.answer, typed: userRaw, ts: Date.now() };
    session.mistakes.push(entry);
    mistakeHistory.push(entry);
    saveMistakeHistory();
  }

  // FIX #7: highlight MCQ buttons
  if (session.practiceType === 'mcq') {
    document.querySelectorAll('.mcq-btn').forEach(btn => {
      btn.disabled = true;
      if (btn.dataset.answer === item.answer) {
        btn.classList.add('mcq-correct');
      } else if (btn.dataset.answer === userAnswer && result === 'wrong') {
        btn.classList.add('mcq-wrong');
      }
    });
  }

  showFeedback(result, item, personIdx);
  updateProgress();
}

function showAnswer() {
  if (session.submitted) return;
  const item = session.current;
  if (!item) return;
  session.submitted = true;

  const input = document.getElementById('answerInput');
  input.disabled = true;
  document.getElementById('btnSubmit').disabled   = true;
  document.getElementById('btnShowAnswer').disabled = true;

  srsUpdate(item.infinitive, item.tense, item.person, 'wrong');
  session.qCount++;
  session.wrongBuffer.push(item);
  const shownEntry = { infinitive: item.infinitive, tense: item.tense, person: item.person, correct: item.answer, typed: '(shown)', ts: Date.now() };
  session.mistakes.push(shownEntry);
  mistakeHistory.push(shownEntry);
  saveMistakeHistory();

  const box = document.getElementById('feedbackBox');
  box.className = 'feedback-box feedback-warn';
  box.innerHTML = `<strong>Answer:</strong> <span class="correct-answer">${escapeHtml(item.answer)}</span>`;

  const personIdx = PERSONS.indexOf(item.person);
  if (COMPOUND_TENSES.includes(item.tense)) {
    const aux = detectAuxiliary(item.tense, personIdx, item.answer);
    box.innerHTML += `<div class="rule-hint">Rule: ${TENSE_LABELS[item.tense]} = auxiliary (${aux}) + past participle</div>`;
  }

  updateProgress();
  triggerAdvance(2400, 'warn');
}

function showFeedback(result, item, personIdx) {
  const box = document.getElementById('feedbackBox');

  let cls, msg;
  if (result === 'correct') {
    cls = 'feedback-correct';
    msg = `<strong>Correct!</strong> <span class="correct-answer">${escapeHtml(item.answer)}</span>`;
  } else if (result === 'partial') {
    cls = 'feedback-warn';
    msg = `<strong>Almost!</strong> Missing accent: <span class="correct-answer">${escapeHtml(item.answer)}</span>`;
  } else {
    cls = 'feedback-incorrect';
    msg = `<strong>Incorrect.</strong> Correct: <span class="correct-answer">${escapeHtml(item.answer)}</span>`;
  }

  // FIX #3: always-correct auxiliary hint
  if (COMPOUND_TENSES.includes(item.tense)) {
    const aux = detectAuxiliary(item.tense, personIdx, item.answer);
    msg += `<div class="rule-hint">Rule: ${TENSE_LABELS[item.tense]} = auxiliary (${aux}) + past participle</div>`;
  }

  box.className = `feedback-box ${cls}`;
  box.innerHTML = msg;

  // FIX #15: longer delay for wrong/partial
  const delay = result === 'correct' ? 1500 : 2400;
  const fillClass = result === 'correct' ? 'fill-correct' : result === 'partial' ? 'fill-warn' : 'fill-incorrect';
  triggerAdvance(delay, fillClass.replace('fill-', ''));
}

function triggerAdvance(delayMs, type) {
  const bar  = document.getElementById('advanceBar');
  const fill = document.getElementById('advanceFill');

  if (session.autoAdvance) {
    // Auto-advance: show countdown bar
    bar.className  = 'advance-bar';
    fill.className = `advance-fill fill-${type}`;
    fill.style.transition = `width ${delayMs}ms linear`;
    fill.style.width = '100%';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { fill.style.width = '0%'; });
    });
    clearTimeout(advanceTimer);
    advanceTimer = setTimeout(() => {
      if (session.mode !== 'micro') nextQuestion();
    }, delayMs);
  } else {
    // Manual advance: hide countdown bar, show Next button
    bar.className = 'advance-bar hidden';
    if (session.practiceType === 'write') {
      document.getElementById('btnNext').classList.remove('hidden');
    } else {
      const row = document.getElementById('mcqNextRow');
      row.classList.remove('hidden');
      row.classList.add('visible');
    }
  }
}

function updateProgress() {
  const el = document.getElementById('progressInfo');
  const masteredCount = session.items.filter(it => isMastered(it.infinitive, it.tense, it.person)).length;
  if (session.qLimit) {
    el.textContent = `Q ${session.qCount}/${session.qLimit} | ✓ ${session.correctCount} | ★ ${masteredCount}/${session.items.length}`;
    const pct = Math.min(100, Math.round((session.qCount / session.qLimit) * 100));
    document.getElementById('progressFill').style.width = pct + '%';
  } else {
    el.textContent = `Q ${session.qCount} | ✓ ${session.correctCount} | ★ ${masteredCount}/${session.items.length}`;
    const pct = Math.min(100, Math.round((masteredCount / session.items.length) * 100));
    document.getElementById('progressFill').style.width = pct + '%';
  }
}

function endSession() {
  clearInterval(session.timerHandle);
  const total = session.qCount;
  const pct   = total ? Math.round((session.correctCount / total) * 100) : 0;
  const masteredCount = session.items.filter(it => isMastered(it.infinitive, it.tense, it.person)).length;

  document.getElementById('summaryText').innerHTML =
    `<strong>Session complete!</strong><br>
     Questions: ${total}<br>
     Correct: ${session.correctCount} (${pct}%)<br>
     Mastered: ${masteredCount}/${session.items.length}`;

  // FIX #12: show mistakes
  const mistakesDiv  = document.getElementById('mistakesReview');
  const mistakesList = document.getElementById('mistakesList');
  if (session.mistakes.length > 0) {
    mistakesList.innerHTML = session.mistakes.map(m =>
      `<div class="mistake-item">
         <span class="mistake-verb">${escapeHtml(m.infinitive)}</span>
         <span class="mistake-tense">${TENSE_LABELS[m.tense] || m.tense} · ${m.person}</span>
         <span class="mistake-arrow">→</span>
         <span class="mistake-correct">${escapeHtml(m.correct)}</span>
         ${m.typed !== '(shown)' ? `<span class="mistake-arrow">you typed:</span><span class="mistake-user">${escapeHtml(m.typed)}</span>` : '<span class="mistake-user">(not attempted)</span>'}
       </div>`
    ).join('');
    mistakesDiv.classList.remove('hidden');
  } else {
    mistakesDiv.classList.add('hidden');
  }

  showScreen('screenSummary');
}

// ─── Micro activity ───────────────────────────────────────────────────────────
let microState = {};

function startMicro() {
  // Pick first selected tense (or random from defaults)
  const tenses = session.selectedTenses && session.selectedTenses.length > 0
    ? session.selectedTenses
    : DEFAULT_TENSES;
  const tense = tenses[Math.floor(Math.random() * tenses.length)];
  let verb = session.verb ? verbs.find(v => v.infinitive === session.verb) : null;
  if (!verb) verb = verbs[Math.floor(Math.random() * verbs.length)];
  if (!verb || !verb[tense]) {
    showToast('No conjugation data for that verb/tense combination.');
    return;
  }
  microState = { verb, tense };
  showScreen('screenMicro');
  renderMicro();
}

function renderMicro() {
  const { verb, tense } = microState;
  document.getElementById('microTitle').textContent =
    `${verb.infinitive} (${verb.english || ''}) — ${TENSE_LABELS[tense] || tense}`;
  const container = document.getElementById('microInputs');
  container.innerHTML = '';
  lastMicroFocused = null;

  PERSONS.forEach((p, idx) => {
    const row   = document.createElement('div');
    row.className = 'micro-row';
    const label = document.createElement('label');
    label.textContent = PERSON_LABELS[idx];
    label.htmlFor = `micro_${p}`;
    const input = document.createElement('input');
    input.type = 'text';
    input.id   = `micro_${p}`;
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('spellcheck', 'false');
    input.addEventListener('focus', () => { lastMicroFocused = input; });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (idx < PERSONS.length - 1) document.getElementById(`micro_${PERSONS[idx + 1]}`).focus();
        else submitMicro();
      }
    });
    row.appendChild(label);
    row.appendChild(input);
    container.appendChild(row);
  });

  document.getElementById(`micro_${PERSONS[0]}`).focus();
  document.getElementById('microFeedback').className = 'hidden';
  document.getElementById('btnMicroSubmit').classList.remove('hidden');
  document.getElementById('btnMicroNext').classList.add('hidden');
}

function submitMicro() {
  const { verb, tense } = microState;
  let html = '';
  let allCorrect = true;

  PERSONS.forEach((p, idx) => {
    const input    = document.getElementById(`micro_${p}`);
    const userVal  = normalize(input.value);
    const correctVal = normalize(verb[tense][idx] || '');

    let result;
    if (userVal === correctVal) {
      result = 'correct';
    } else if (!session.strictAccents && stripAccents(userVal) === stripAccents(correctVal)) {
      result = 'partial';
    } else {
      result = 'wrong';
    }

    if (result !== 'correct') allCorrect = false;
    srsUpdate(verb.infinitive, tense, p, result);
    input.disabled = true; // FIX #26

    if (result === 'correct') {
      input.classList.add('input-correct');
    } else if (result === 'partial') {
      input.classList.add('input-incorrect'); // show as wrong visually
      html += `<div>${PERSON_LABELS[idx]}: <strong>${escapeHtml(verb[tense][idx])}</strong> <em>(accent missing)</em></div>`;
    } else {
      input.classList.add('input-incorrect');
      html += `<div>${PERSON_LABELS[idx]}: <strong>${escapeHtml(verb[tense][idx])}</strong></div>`;
    }
  });

  const fb = document.getElementById('microFeedback');
  fb.className = allCorrect ? 'feedback-box feedback-correct' : 'feedback-box feedback-incorrect';
  fb.innerHTML = allCorrect ? '<strong>All correct! 🎉</strong>' : '<strong>Corrections:</strong>' + html;

  document.getElementById('btnMicroSubmit').classList.add('hidden');
  document.getElementById('btnMicroNext').classList.remove('hidden');
}

function nextMicro() {
  const tenses = session.selectedTenses && session.selectedTenses.length > 0 ? session.selectedTenses : DEFAULT_TENSES;
  const tense = tenses[Math.floor(Math.random() * tenses.length)];
  let nextVerb;

  if (session.verb) {
    nextVerb = verbs.find(v => v.infinitive === session.verb) || verbs[0];
  } else {
    // FIX #27: weighted-random, not always worst
    const eligible = verbs.filter(v => v[tense]);
    if (eligible.length === 0) { endSession(); return; }
    const scored = eligible.map(v => {
      const total = PERSONS.reduce((s, p) => s + srsGet(v.infinitive, tense, p).weight, 0);
      return { v, score: total };
    });
    // pick from top 5 worst by weight, randomly
    scored.sort((a, b) => b.score - a.score);
    const topN  = scored.slice(0, Math.min(5, scored.length));
    nextVerb = topN[Math.floor(Math.random() * topN.length)].v;
  }

  microState = { verb: nextVerb, tense };
  renderMicro();
}

// ─── Accent toolbar (FIX #9) ─────────────────────────────────────────────────
function insertAccent(ch, targetInput) {
  if (!targetInput) return;
  targetInput.focus();
  const start = targetInput.selectionStart;
  const end   = targetInput.selectionEnd;
  const val   = targetInput.value;
  targetInput.value = val.slice(0, start) + ch + val.slice(end);
  targetInput.selectionStart = targetInput.selectionEnd = start + ch.length;
}

// ─── CSV / XLSX parsing ───────────────────────────────────────────────────────
function parseCSVText(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { verbs: [], skipped: 0 };

  const headers = parseCSVLine(lines[0]);
  const results = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length === 0) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h.trim()] = (cols[idx] || '').trim(); });
    const verb = rowToVerb(row);
    if (verb) results.push(verb);
    else skipped++;
  }
  return { verbs: results, skipped };
}

function parseCSVLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    // FIX #90: handle escaped quotes ""
    if (ch === '"' && inQ && line[i + 1] === '"') { cur += '"'; i++; continue; }
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { result.push(cur); cur = ''; continue; }
    cur += ch;
  }
  result.push(cur);
  return result;
}

function rowToVerb(row) {
  const infinitive = row['infinitive'];
  if (!infinitive) return null;
  const verb = { infinitive, english: row['english'] || '' };
  let hasData = false;
  TENSES.forEach(t => {
    const entries = PERSONS.map(p => row[`${t}_${p}`] || '');
    if (entries.some(e => e)) { verb[t] = entries; hasData = true; }
  });
  return hasData ? verb : null;
}

function handleFileUpload(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'csv') {
    const reader = new FileReader();
    reader.onload = e => {
      const { verbs: parsed, skipped } = parseCSVText(e.target.result);
      applyLoadedVerbs(parsed, file.name, skipped);
    };
    reader.readAsText(file, 'UTF-8');
  } else if (ext === 'xlsx' || ext === 'xls') {
    if (typeof XLSX === 'undefined') { showToast('SheetJS not loaded — cannot parse XLSX.'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb  = XLSX.read(e.target.result, { type: 'array' });
        const ws  = wb.Sheets[wb.SheetNames[0]];
        const csv = XLSX.utils.sheet_to_csv(ws);
        const { verbs: parsed, skipped } = parseCSVText(csv);
        applyLoadedVerbs(parsed, file.name, skipped);
      } catch(err) { showToast('Error reading XLSX: ' + err.message); }
    };
    reader.readAsArrayBuffer(file);
  } else {
    showToast('Unsupported file type. Use .csv or .xlsx');
  }
}

function applyLoadedVerbs(parsed, source, skipped) {
  if (!parsed || parsed.length === 0) {
    showToast(`No valid verbs found in ${source}. Check column names.`);
    return;
  }
  parsed.forEach(v => {
    const idx = verbs.findIndex(x => x.infinitive === v.infinitive);
    if (idx !== -1) verbs[idx] = v;
    else { verbs.push(v); customVerbs.push(v); }
  });
  refreshUI();
  const msg = skipped > 0
    ? `Loaded ${parsed.length} verb(s) from ${source}. (${skipped} rows skipped)`
    : `Loaded ${parsed.length} verb(s) from ${source}.`;
  showToast(msg);
}

function handlePasteImport() {
  const text = document.getElementById('pasteArea').value;
  if (!text.trim()) return;
  const { verbs: parsed, skipped } = parseCSVText(text);
  applyLoadedVerbs(parsed, 'paste', skipped);
  document.getElementById('pasteArea').value = '';
}

// ─── SRS export/import ───────────────────────────────────────────────────────
// FIX #56: only export SRS progress + custom verbs
function exportSRS() {
  const data = JSON.stringify({ srs, customVerbs }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'french_srs_backup.json'; a.click();
  URL.revokeObjectURL(url);
}

function importSRS(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.srs) { srs = data.srs; saveSRS(); }
      if (data.customVerbs && data.customVerbs.length) {
        data.customVerbs.forEach(v => {
          const idx = verbs.findIndex(x => x.infinitive === v.infinitive);
          if (idx !== -1) verbs[idx] = v;
          else { verbs.push(v); customVerbs.push(v); }
        });
        refreshUI();
      }
      showToast('Backup restored.');
    } catch(err) { showToast('Invalid backup file: ' + err.message); }
  };
  reader.readAsText(file, 'UTF-8');
}

// ─── UI helpers ──────────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

let toastTimeout = null;
function showToast(msg, duration = 3500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden', 'fading');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    el.classList.add('fading');
    setTimeout(() => el.classList.add('hidden'), 420);
  }, duration);
}

function refreshUI() {
  const selVerb = document.getElementById('selVerb');
  selVerb.innerHTML = '<option value="">-- all verbs --</option>';
  verbs.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.infinitive;
    opt.textContent = v.infinitive + (v.english ? ` (${v.english})` : '');
    selVerb.appendChild(opt);
  });

  document.getElementById('verbCount').textContent = `${verbs.length} verb(s) loaded`;
  document.getElementById('headerVerbCount').textContent = verbs.length;
  renderStats();
}

function renderStats() {
  renderStatsOverview();
  renderStatsTenses();
  renderStatsVerbs();
  renderStatsHistory();
}

function renderStatsOverview() {
  const el = document.getElementById('statsOverview');
  if (!el) return;

  let totalItems = 0, masteredTotal = 0, totalSeen = 0, totalCorrect = 0;
  verbs.forEach(v => {
    TENSES.forEach(t => {
      if (!v[t]) return;
      PERSONS.forEach(p => {
        totalItems++;
        const d = srsGet(v.infinitive, t, p);
        totalSeen    += d.times_seen;
        totalCorrect += d.times_correct;
        if (isMastered(v.infinitive, t, p)) masteredTotal++;
      });
    });
  });
  const overallPct = totalItems ? Math.round(masteredTotal / totalItems * 100) : 0;
  const accuracy   = totalSeen  ? Math.round(totalCorrect / totalSeen * 100) : 0;

  el.innerHTML = `
    <h2>Overall Progress</h2>
    <div class="stats-big-numbers">
      <div class="stat-big"><span class="stat-big-value">${masteredTotal}</span><span class="stat-big-label">Mastered</span></div>
      <div class="stat-big"><span class="stat-big-value">${overallPct}%</span><span class="stat-big-label">of items</span></div>
      <div class="stat-big"><span class="stat-big-value">${totalSeen}</span><span class="stat-big-label">Total answers</span></div>
      <div class="stat-big"><span class="stat-big-value">${accuracy}%</span><span class="stat-big-label">Accuracy</span></div>
      <div class="stat-big"><span class="stat-big-value">${mistakeHistory.length}</span><span class="stat-big-label">Mistakes logged</span></div>
    </div>
    <p style="font-size:0.82rem;color:var(--text-muted)">
      An item is considered mastered once its SRS weight drops below ${MASTERY_WEIGHT} (seen at least ${MASTERY_MIN_SEEN} times).
      Your progress is automatically saved in this browser.
    </p>`;
}

function renderStatsTenses() {
  const el = document.getElementById('statsTenses');
  if (!el) return;

  const rows = TENSES.filter(t => verbs.some(v => v[t])).map(t => {
    let tm = 0, tt = 0, seen = 0, correct = 0;
    verbs.forEach(v => {
      if (!v[t]) return;
      PERSONS.forEach(p => {
        tt++;
        const d = srsGet(v.infinitive, t, p);
        seen += d.times_seen; correct += d.times_correct;
        if (isMastered(v.infinitive, t, p)) tm++;
      });
    });
    const pct = tt ? Math.round(tm / tt * 100) : 0;
    const acc = seen ? Math.round(correct / seen * 100) : 0;
    const tag = ORIGINAL_TENSES.has(t)
      ? '<span style="font-size:0.7rem;color:#2d7a50;font-weight:bold">✦ orig</span>'
      : '<span style="font-size:0.7rem;color:#c05010;font-weight:bold">⊕ comp</span>';
    return `<tr>
      <td>${TENSE_LABELS[t] || t} ${tag}</td>
      <td>${tm}/${tt}</td>
      <td><div class="tense-track" style="min-width:60px"><div class="tense-fill" style="width:${pct}%"></div></div></td>
      <td style="font-family:var(--mono)">${pct}%</td>
      <td style="font-family:var(--mono)">${acc}%</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <h2>By Tense</h2>
    <table class="stats-table">
      <thead><tr><th>Tense</th><th>Mastered</th><th>Progress</th><th>%</th><th>Accuracy</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderStatsVerbs() {
  const el = document.getElementById('statsVerbs');
  if (!el) return;

  const rows = verbs.map(v => {
    let vm = 0, vt = 0, seen = 0, correct = 0;
    TENSES.forEach(t => {
      if (!v[t]) return;
      PERSONS.forEach(p => {
        vt++;
        const d = srsGet(v.infinitive, t, p);
        seen += d.times_seen; correct += d.times_correct;
        if (isMastered(v.infinitive, t, p)) vm++;
      });
    });
    const pct = vt ? Math.round(vm / vt * 100) : 0;
    const acc = seen ? Math.round(correct / seen * 100) : 0;
    return `<tr>
      <td><strong>${escapeHtml(v.infinitive)}</strong></td>
      <td style="font-size:0.78rem;color:var(--text-muted)">${escapeHtml(v.english || '')}</td>
      <td>${vm}/${vt}</td>
      <td><div class="tense-track" style="min-width:50px"><div class="tense-fill" style="width:${pct}%"></div></div></td>
      <td style="font-family:var(--mono)">${acc}%</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <h2>By Verb</h2>
    <table class="stats-table">
      <thead><tr><th>Verb</th><th>English</th><th>Mastered</th><th>Progress</th><th>Accuracy</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderStatsHistory() {
  const el = document.getElementById('statsHistory');
  if (!el) return;

  if (mistakeHistory.length === 0) {
    el.innerHTML = '<h2>Mistake History</h2><p style="color:var(--text-muted);font-size:0.88rem">No mistakes recorded yet.</p>';
    return;
  }

  // Most recent 100, reversed (newest first)
  const recent = [...mistakeHistory].reverse().slice(0, 100);

  // Most-missed verbs summary
  const counts = {};
  mistakeHistory.forEach(m => {
    const k = m.infinitive;
    counts[k] = (counts[k] || 0) + 1;
  });
  const top5 = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,5);

  const topHtml = top5.map(([inf, n]) =>
    `<span class="stat-pill">${escapeHtml(inf)}: ${n}✗</span>`
  ).join(' ');

  const rows = recent.map(m => {
    const d = new Date(m.ts);
    const time = `${d.getDate()}/${d.getMonth()+1} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
    return `<tr>
      <td>${escapeHtml(m.infinitive)}</td>
      <td>${TENSE_LABELS[m.tense] || m.tense} · ${m.person}</td>
      <td class="history-correct">${escapeHtml(m.correct)}</td>
      <td class="history-wrong">${escapeHtml(m.typed)}</td>
      <td style="font-size:0.75rem;color:var(--text-muted)">${time}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <h2>Mistake History <span style="font-size:0.78rem;color:var(--text-muted);font-weight:normal">(last ${recent.length} of ${mistakeHistory.length})</span></h2>
    <div class="stats-summary" style="margin-bottom:0.75rem">${topHtml}</div>
    <p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:0.5rem">Most-missed verbs shown above. Full log below (newest first).</p>
    <table class="history-table">
      <thead><tr><th>Verb</th><th>Tense · Person</th><th>Correct</th><th>You typed</th><th>When</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="btn-row" style="margin-top:0.75rem">
      <button onclick="if(confirm('Clear all mistake history?')){mistakeHistory=[];saveMistakeHistory();renderStatsHistory();}" class="btn-danger">Clear history</button>
    </div>`;
}

// ─── Tense picker builder ─────────────────────────────────────────────────────
function buildTensePicker() {
  const container = document.getElementById('tensePicker');
  if (!container) return;
  container.innerHTML = '';

  const savedKey = 'frenchSRS_tenses';
  let saved;
  try { saved = JSON.parse(localStorage.getItem(savedKey)); } catch(_) {}
  const active = new Set(Array.isArray(saved) ? saved : DEFAULT_TENSES);

  TENSES.forEach(t => {
    const label = document.createElement('label');
    label.className = 'tense-check-label ' + (ORIGINAL_TENSES.has(t) ? 'is-original' : 'is-compound');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = t;
    cb.checked = active.has(t);
    cb.addEventListener('change', () => {
      const checked = Array.from(container.querySelectorAll('input:checked')).map(c => c.value);
      localStorage.setItem(savedKey, JSON.stringify(checked));
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(TENSE_LABELS[t] || t));
    container.appendChild(label);
  });
}

function setTensePickerAll(mode) {
  const cbs = document.querySelectorAll('#tensePicker input[type=checkbox]');
  cbs.forEach(cb => {
    if (mode === 'all')      cb.checked = true;
    else if (mode === 'none') cb.checked = false;
    else if (mode === 'original') cb.checked = ORIGINAL_TENSES.has(cb.value);
    else if (mode === 'compound') cb.checked = !ORIGINAL_TENSES.has(cb.value);
  });
  const checked = Array.from(cbs).filter(c => c.checked).map(c => c.value);
  localStorage.setItem('frenchSRS_tenses', JSON.stringify(checked));
}

// ─── DOM event wiring ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadSRS();
  verbs = BUILTIN_VERBS.map(v => ({ ...v }));
  buildTensePicker();
  refreshUI();

  // Dark mode
  const savedDark = localStorage.getItem('frenchSRS_dark') === '1';
  if (savedDark) document.body.classList.add('dark');
  document.getElementById('btnDarkMode').textContent = savedDark ? '☀️' : '🌙';
  document.getElementById('btnDarkMode').addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark');
    document.getElementById('btnDarkMode').textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('frenchSRS_dark', isDark ? '1' : '0');
  });

  // Tense picker quick-select buttons
  document.getElementById('btnSelectAllTenses').addEventListener('click', () => setTensePickerAll('all'));
  document.getElementById('btnSelectNone').addEventListener('click',       () => setTensePickerAll('none'));
  document.getElementById('btnSelectOriginal').addEventListener('click',   () => setTensePickerAll('original'));
  document.getElementById('btnSelectCompound').addEventListener('click',   () => setTensePickerAll('compound'));

  // Mode selector — show/hide chunk size and verb selector
  const selMode = document.getElementById('selMode');
  selMode.addEventListener('change', updateModeVisibility);
  function updateModeVisibility() {
    const m = selMode.value;
    document.getElementById('rowTensePicker').style.display = (m === 'auxiliary') ? 'none' : '';
    document.getElementById('rowVerb').style.display   = (m === 'byVerb' || m === 'micro') ? '' : 'none';
    document.getElementById('rowChunk').style.display  = (m === 'byTense') ? '' : 'none';
  }
  updateModeVisibility();

  // Start
  document.getElementById('btnStart').addEventListener('click', () => startSession());

  // Quick session
  document.getElementById('btnQuickSession').addEventListener('click', () => {
    const items = buildWeakestItems(10);
    if (items.length === 0) { showToast('No SRS data yet — start a regular session first.'); return; }
    Object.assign(session, {
      mode: 'mixed', selectedTenses: [...DEFAULT_TENSES], verb: '',
      qLimit: 0, timeLimit: 0,
      strictAccents: document.getElementById('chkAccents').checked,
      practiceType: document.getElementById('selPractice').value,
      autoAdvance: document.getElementById('chkAutoAdvance').checked,
      qCount: 0, correctCount: 0, wrongBuffer: [], submitted: false, mistakes: [],
      items, queue: shuffle([...items]),
    });
    showScreen('screenPractice');
    updateProgress();
    nextQuestion();
    startTimer();
  });

  // Write mode submit + keys
  document.getElementById('btnSubmit').addEventListener('click', () => submitAnswer());
  document.getElementById('answerInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); submitAnswer(); }
    if (e.key === 'Escape') { document.getElementById('answerInput').value = ''; }
  });

  // Manual Next button (write mode)
  document.getElementById('btnNext').addEventListener('click', () => {
    document.getElementById('btnNext').classList.add('hidden');
    clearTimeout(advanceTimer);
    nextQuestion();
  });

  // Manual Next button (MCQ mode)
  document.getElementById('btnNextMCQ').addEventListener('click', () => {
    const row = document.getElementById('mcqNextRow');
    row.classList.add('hidden');
    row.classList.remove('visible');
    clearTimeout(advanceTimer);
    nextQuestion();
  });

  // Space = next in manual mode
  document.addEventListener('keydown', e => {
    if (e.key === ' ' && e.target === document.body) {
      if (!session.autoAdvance && session.submitted) {
        e.preventDefault();
        const nw = document.getElementById('btnNext');
        const nm = document.getElementById('btnNextMCQ');
        if (!nw.classList.contains('hidden')) { nw.click(); }
        else if (nm.classList.contains('visible')) { nm.click(); }
      }
    }
  });

  // Show answer
  document.getElementById('btnShowAnswer').addEventListener('click', showAnswer);

  // MCQ keyboard 1-4
  document.addEventListener('keydown', e => {
    if (document.getElementById('screenPractice').classList.contains('hidden')) return;
    if (session.practiceType !== 'mcq') return;
    if (session.submitted) return;
    const n = parseInt(e.key);
    if (n >= 1 && n <= 4) {
      const btns = document.querySelectorAll('.mcq-btn');
      if (btns[n - 1]) btns[n - 1].click();
    }
  });

  // End session
  document.getElementById('btnEndSession').addEventListener('click', endSession);

  // Summary buttons
  document.getElementById('btnBackToSetup').addEventListener('click', () => {
    showScreen('screenSetup');
    renderStats();
  });
  document.getElementById('btnRestartSession').addEventListener('click', () => {
    if (session.lastSessionOpts) {
      showScreen('screenSetup');
      startSession();
    }
  });

  // Micro
  document.getElementById('btnMicroSubmit').addEventListener('click', submitMicro);
  document.getElementById('btnMicroNext').addEventListener('click', nextMicro);
  document.getElementById('btnMicroEnd').addEventListener('click', endSession);

  // Accent toolbars
  document.querySelectorAll('#accentBar .accent-btn').forEach(btn => {
    btn.addEventListener('mousedown', e => {
      e.preventDefault();
      insertAccent(btn.dataset.char, document.getElementById('answerInput'));
    });
  });
  document.querySelectorAll('#accentBarMicro .micro-accent').forEach(btn => {
    btn.addEventListener('mousedown', e => {
      e.preventDefault();
      insertAccent(btn.dataset.char, lastMicroFocused);
    });
  });

  // File upload
  document.getElementById('fileInput').addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) handleFileUpload(f);
    e.target.value = '';
  });

  // Paste import
  document.getElementById('btnPasteImport').addEventListener('click', handlePasteImport);

  // SRS export / import
  document.getElementById('btnExport').addEventListener('click', exportSRS);
  document.getElementById('btnImport').addEventListener('click', () => document.getElementById('importInput').click());
  document.getElementById('importInput').addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) importSRS(f);
    e.target.value = '';
  });

  // Reset SRS
  document.getElementById('btnResetSRS').addEventListener('click', () => {
    if (confirm('Reset all SRS progress? Export first if you want a backup.')) {
      srs = {};
      saveSRS();
      renderStats();
      showToast('SRS progress reset.');
    }
  });

  // Main tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.tab;
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
      document.getElementById('tab' + target).classList.remove('hidden');
      if (target === 'Stats') renderStats();
    });
  });

  // Stats sub-tabs
  document.querySelectorAll('.stats-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.stats-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.stats-panel').forEach(p => p.classList.add('hidden'));
      const stabId = 'stats' + btn.dataset.stab.charAt(0).toUpperCase() + btn.dataset.stab.slice(1);
      document.getElementById(stabId).classList.remove('hidden');
    });
  });

  showScreen('screenSetup');
});
