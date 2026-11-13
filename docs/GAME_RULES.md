# Classic Qwixx — specyfikacja reguł

**Status:** specyfikacja implementacyjna v0.1  
**Wariant:** `classic`  
**Zakres:** podstawowa gra dla 2–5 graczy.  
**Cel:** jednoznaczne zasady dla silnika, testów, symulatora i agentów AI.

> Źródło prawdy dla zgodności licencyjnej i szczegółów wariantu stanowi instrukcja fizycznego wydania Classic Qwixx. Poniższy dokument jest techniczną parafrazą reguł, a nie reprodukcją instrukcji wydawcy. Przed wydaniem aplikacji należy porównać przypadki brzegowe z instrukcją wybranego wydania.

## 1. Elementy gry

- Sześć kości: dwie białe oraz po jednej czerwonej, żółtej, zielonej i niebieskiej; każda sześciościenna (1–6).
- Każdy gracz ma cztery rzędy pól:
  - czerwony: `2,3,4,5,6,7,8,9,10,11,12`;
  - żółty: `2,3,4,5,6,7,8,9,10,11,12`;
  - zielony: `12,11,10,9,8,7,6,5,4,3,2`;
  - niebieski: `12,11,10,9,8,7,6,5,4,3,2`.
- Każdy arkusz ma cztery miejsca na karne skreślenia (failed throws).
- Zamykanie rzędu jest wspólne dla wszystkich graczy: po zamknięciu nie można w nim już zaznaczać pól.

## 2. Podstawowa zasada zaznaczania

W każdym rzędzie wolno zaznaczać wyłącznie od lewej do prawej. Wolno przeskakiwać pola, ale nigdy nie wolno wrócić do pominiętych pól.

Pole jest legalne, jeżeli:
1. należy do wskazanego rzędu;
2. rząd nie jest globalnie zamknięty;
3. leży ściśle na prawo od ostatniego zaznaczonego pola tego gracza w tym rzędzie;
4. odpowiada sumie dozwolonej kombinacji kości w aktualnej fazie;
5. spełnia dodatkowy warunek dla ostatniego pola, jeśli jest skrajnie prawe.

## 3. Tura

1. **Rzut:** aktywny gracz rzuca wszystkimi kośćmi, które pozostają w grze. Kość koloru zamkniętego rzędu jest usuwana z gry.
2. **Białe kości — wszyscy gracze:** suma dwóch białych kości jest dostępna dla każdego gracza. Każdy może zaznaczyć jedno odpowiadające jej pole w dowolnym otwartym rzędzie albo spasować. Decyzje graczy są niezależne.
3. **Biała + kolorowa — tylko aktywny gracz:** aktywny gracz może dodatkowo wybrać jedną białą kość i jedną dostępną kość kolorową, zsumować ich wyniki i zaznaczyć jedno odpowiadające pole w rzędzie tego koloru albo spasować.
4. **Kara:** jeżeli aktywny gracz nie zaznaczył żadnego pola w obu fazach, otrzymuje jedno karne skreślenie. Gracze nieaktywni nie otrzymują kary za pasowanie.
5. **Koniec tury:** po rozstrzygnięciu obu faz i ewentualnych zamknięć następuje sprawdzenie końca gry i przekazanie aktywności kolejnemu graczowi. Wyjątkiem jest zamknięcie drugiego koloru podczas rozliczania fazy białej: gra kończy się natychmiast po atomowym rozliczeniu całej tej fazy, bez fazy kolorowej.

Aktywny gracz może zaznaczyć **zero, jedno lub dwa pola** w turze (maksymalnie jedno w każdej fazie). Jeżeli oba zaznaczenia dotyczą tego samego rzędu, drugie musi być na prawo od pierwszego. Zaznaczenie w fazie białej jest rozpatrywane przed zaznaczeniem z kości kolorowej.

### Ważna uwaga o kolejności decyzji

W trybie online faza białych kości wymaga zebrania decyzji wszystkich graczy. Silnik nie może zakończyć tej fazy po odpowiedzi tylko aktywnego gracza. Wszystkie decyzje są rozliczane atomowo względem stanu z początku fazy, niezależnie od kolejności zgłoszenia. Po ich rozliczeniu silnik przechodzi do fazy kolorowej aktywnego gracza, chyba że faza biała zamknęła drugi kolor i zakończyła grę.

## 4. Zamknięcie rzędu

- Skrajnie prawe pole w rzędzie (czerwony/żółty: `12`; zielony/niebieski: `2`) można zaznaczyć tylko wtedy, gdy gracz miał wcześniej zaznaczonych **co najmniej pięć** pól w tym rzędzie.
- Zaznaczenie tego pola oznacza również zaznaczenie symbolu kłódki. Kłódka liczy się jako dodatkowe zaznaczenie do punktacji danego rzędu.
- Rząd zostaje globalnie zamknięty i nikt nie może już w nim zaznaczać pól. Odpowiadająca kość kolorowa jest usuwana z kolejnych rzutów, a kolor zamknięty w fazie białej jest niedostępny również w fazie kolorowej tej samej tury.
- Zamknięcie może nastąpić również w fazie białych kości. Wszystkie legalne deklaracje z tej fazy są rozstrzygane atomowo względem stanu fazy sprzed zamknięcia, a dopiero potem stosowane są globalne zamknięcia. Wynik nie zależy od kolejności zgłoszenia decyzji.
- W jednym rzucie kilku graczy może spełnić warunki zamknięcia tego samego rzędu w fazie wspólnej. Każdy uprawniony gracz otrzymuje własne zaznaczenie skrajnego pola i kłódki.

## 5. Zakończenie gry

Gra kończy się, gdy zajdzie **którykolwiek** warunek:
- jeden z graczy otrzyma **czwarte** karne skreślenie;
- zostaną zamknięte **dwa różne** kolorowe rzędy.

Jeżeli drugi kolor zostanie zamknięty podczas atomowego rozliczania fazy białej, wszystkie legalne decyzje tej fazy zostają zastosowane, po czym gra natychmiast przechodzi do stanu zakończonego. Faza kolorowa nie następuje i aktywny gracz nie otrzymuje kary za jej niewykonanie. Nie rozpoczyna się kolejnej tury. Wynik nie może zależeć od kolejności nadejścia komunikatów klientów.

## 6. Punktacja

Dla każdego rzędu liczba punktów zależy od liczby zaznaczeń (wliczając kłódkę, jeżeli dany gracz zamknął rząd):

| Zaznaczenia | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Punkty | 0 | 1 | 3 | 6 | 10 | 15 | 21 | 28 | 36 | 45 | 55 | 66 | 78 |

Każde karne skreślenie: **−5 punktów**.

`wynik = suma(punktów za cztery rzędy) − 5 × liczba_kar`.

Wygrywa gracz z najwyższą liczbą punktów. Remis w punktach pozostaje remisem; ewentualny tie-break w rankingach online jest osobną regułą produktu, a nie zmianą klasycznej punktacji.

## 7. Model akcji i faz — wymagania

- `ROLL`: losowanie sześciu/dostępnych kości, wyłącznie po stronie autorytatywnego silnika.
- `MARK_WHITE(row)`, `PASS_WHITE`: po jednej decyzji od każdego gracza.
- `MARK_COLOR(row, whiteDieId)`, `PASS_COLOR`: tylko aktywny gracz.
- Przejście fazy następuje automatycznie po zebraniu ostatniej wymaganej decyzji. Po fazie białej silnik atomowo stosuje wszystkie decyzje i sprawdza koniec gry; nie istnieje osobna publiczna akcja `ADVANCE`.
- `MARK_*` nie przyjmuje dowolnej liczby jako zaufanego argumentu: liczba wynika z bieżących kości. Można ją przechowywać w akcji dla diagnostyki, ale serwer musi ją ponownie obliczyć.
- Stan musi przechowywać, kto już podjął decyzję w bieżącej fazie, aby odrzucać duplikaty i spóźnione akcje.
- Losowość jest wstrzykiwana (seedowany generator lub zewnętrznie podany rzut), nigdy ukryta wewnątrz `applyAction`.

## 8. Niezmienniki

1. Żaden gracz nie może zaznaczyć pola na lewo od ostatniego zaznaczenia w danym rzędzie.
2. W rzędzie nie ma podwójnych zaznaczeń tego samego pola.
3. Po zamknięciu rzędu nie powstają w nim nowe zaznaczenia w następnych fazach/rzutach.
4. Liczba kar gracza jest w zakresie 0–4.
5. W fazie białej każdy gracz podejmuje co najwyżej jedną decyzję.
6. W fazie kolorowej decyzję podejmuje tylko aktywny gracz, co najwyżej raz.
7. Punkty zawsze są wyliczalne ze stanu arkusza, bez osobnego modyfikowalnego licznika jako źródła prawdy.
8. Ten sam stan, akcja i rzut dają ten sam wynik (determinizm).
9. Zakończona gra nie akceptuje kolejnych akcji.
10. Zamknięty rząd ma dokładnie jedną globalną flagę zamknięcia, niezależnie od liczby graczy, którzy zamknęli go w tym samym rzucie.

## 9. Minimalny katalog testów

- Kierunek czerwonego/żółtego rosnący, zielonego/niebieskiego malejący.
- Pominięte pole nie może zostać później zaznaczone.
- Suma białych kości może zostać zaznaczona w dowolnym legalnym otwartym rzędzie.
- Aktywny gracz może użyć każdej z dwóch białych kości w fazie kolorowej, ale tylko z jedną kolorową kością i dla jednego zaznaczenia.
- Gracz nieaktywny nie może wykonać akcji kolorowej.
- Brak zaznaczenia przez aktywnego gracza powoduje dokładnie jedną karę, nie dwie.
- Brak zaznaczenia przez nieaktywnego gracza nie powoduje kary.
- Skrajnego prawego pola nie wolno zaznaczyć przy czterech wcześniejszych zaznaczeniach; wolno przy pięciu.
- Zamknięcie dodaje kłódkę do liczby zaznaczeń.
- Zamknięty rząd usuwa kość z kolejnych rzutów.
- Czwarta kara kończy grę; trzecia nie.
- Drugie zamknięcie kończy grę; pierwsze nie.
- Dwie równoczesne deklaracje w fazie wspólnej nie zależą od kolejności przetwarzania komunikatów.
- Kilku uprawnionych graczy może równocześnie zamknąć ten sam rząd; każdy otrzymuje ostatnią liczbę i własną kłódkę, a punktacja każdego uwzględnia oba zaznaczenia.
- Kolor zamknięty podczas fazy białej nie jest dostępny w fazie kolorowej tej samej tury.
- Zamknięcie drugiego koloru w fazie białej kończy grę po zastosowaniu wszystkich decyzji tej fazy; faza kolorowa jest pomijana i nie nalicza się kary za jej niewykonanie.
- Duplikat akcji nie może podwoić zaznaczenia.
- Punktacja tabelaryczna dla 0–12 zaznaczeń i kar.
- Testy własnościowe: brak nielegalnych stanów po długich losowych sekwencjach; odtwarzalność przy tym samym seedzie.

## 10. Zakres przyszłych dodatków

Na MVP implementujemy **wyłącznie `classic`**. Każda partia zapisuje `rulesetId: 'classic'` oraz `rulesetVersion`. Przyszłe warianty mogą zmienić układ rzędów, dostępne akcje, punktację albo warunki końca gry; nie zakładamy, że wszystkie będą prostą zmianą konfiguracji. Nie projektujemy obecnie ogólnego systemu pluginów.

## 11. Decyzje przyszłych etapów

1. Czy interfejs ma umożliwiać anulowanie wyboru **przed** zatwierdzeniem fazy (UX), przy nieodwracalnych akcjach po zatwierdzeniu.
2. Czy symulator ma modelować przeciwników jako osobnych agentów od pierwszej iteracji (rekomendacja: tak).

**Zasada:** nie dopasowujemy reguł do zachowania testów; testy mają wynikać z zatwierdzonej specyfikacji.
