# Multiplayer MVP

## Minimalny przepływ

1. Serwer tworzy pokój i gospodarza, zapisuje wyłącznie hash losowego sekretu uczestnika, a sekret umieszcza w ciasteczku `HttpOnly` przypisanym do ścieżki pokoju.
2. Dołączenie kodem lub linkiem tworzy nowego uczestnika tylko w lobby i tylko do limitu pięciu miejsc. Kod pokoju nie uwierzytelnia gracza.
3. Gospodarz rozpoczyna grę dla aktualnej, uporządkowanej listy 2–5 uczestników. Serwer tworzy stan silnika i wykonuje kryptograficzny rzut.
4. Każda akcja jest wiązana z uczestnikiem odczytanym z ciasteczka. Serwer ignoruje ewentualny identyfikator gracza przesłany przez klienta i ponownie waliduje akcję silnikiem.
5. Zapis gry używa wersji compare-and-swap. Przy konflikcie serwer ponownie odczytuje stan i waliduje akcję; duplikaty są odrzucane przez silnik.
6. Realtime udostępnia wyłącznie `room_snapshots.public_state`. Oczekujące decyzje fazy białej pozostają w prywatnej tabeli `room_games`; klient widzi tylko identyfikatory osób, które już odpowiedziały.

## Schemat

- `rooms`: unikalny sześci znakowy kod, status i gospodarz.
- `room_participants`: nick, miejsce oraz hash sekretu sesji; maksymalnie pięć miejsc na pokój.
- `room_games`: pełny prywatny stan silnika i monotoniczna wersja zapisu.
- `room_snapshots`: oczyszczony stan przeznaczony do odczytu przez Realtime.

Funkcje `create_room_with_host`, `join_room`, `start_room_game` i `commit_room_game` wykonują wielotabelowe zmiany transakcyjnie. RLS zezwala tokenowi uczestnika wyłącznie na odczyt własnego pokoju; zapis pozostaje dostępny tylko dla serwera z kluczem `service_role`.

## Konfiguracja

1. Zastosuj migrację z `supabase/migrations` w projekcie Supabase.
2. Skopiuj nazwy zmiennych z `.env.example` do lokalnego `.env` i podaj wartości projektu.
3. Uruchom `npm run dev`.

`SUPABASE_JWT_SECRET` służy do podpisywania krótkotrwałych tokenów uczestników dla Realtime. Nie jest wysyłany do przeglądarki. `SUPABASE_SERVICE_ROLE_KEY` jest używany wyłącznie w modułach serwerowych.
