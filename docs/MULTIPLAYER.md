# Multiplayer MVP

## Minimalny przepływ

1. Serwer tworzy pokój i gospodarza, zapisuje wyłącznie hash losowego sekretu uczestnika, a sekret umieszcza w ciasteczku `HttpOnly` przypisanym do ścieżki pokoju.
2. Dołączenie kodem lub linkiem tworzy nowego uczestnika tylko w lobby i tylko do limitu pięciu miejsc. Kod pokoju nie uwierzytelnia gracza.
3. Gospodarz rozpoczyna grę dla aktualnej, uporządkowanej listy 2–5 uczestników. Serwer tworzy stan silnika i wykonuje kryptograficzny rzut.
4. Każda akcja jest wiązana z uczestnikiem odczytanym z ciasteczka. Serwer ignoruje ewentualny identyfikator gracza przesłany przez klienta i ponownie waliduje akcję silnikiem.
5. Zapis gry używa wersji compare-and-swap. Przy konflikcie serwer ponownie odczytuje stan i waliduje akcję; duplikaty są odrzucane przez silnik.
6. Klient okresowo odświeża widok pokoju przez SvelteKit. Oczekujące decyzje fazy białej pozostają w prywatnej tabeli `room_games`; klient widzi tylko identyfikatory osób, które już odpowiedziały.

## Schemat

- `rooms`: unikalny sześci znakowy kod, status i gospodarz.
- `room_participants`: nick, miejsce oraz hash sekretu sesji; maksymalnie pięć miejsc na pokój.
- `room_games`: pełny prywatny stan silnika i monotoniczna wersja zapisu.

Funkcje `create_room_with_host`, `join_room`, `start_room_game` i `commit_room_game` wykonują wielotabelowe zmiany transakcyjnie. Aplikacja łączy się z Supabase wyłącznie na serwerze SvelteKit przez `service_role`; to ciasteczko sesji uczestnika oraz `RoomService` decydują o dostępie do pokoju. RLS pozostaje dodatkową ochroną tabel, ale nie jest mechanizmem autoryzacji klienta.

## Konfiguracja

1. Zastosuj migrację z `supabase/migrations` w projekcie Supabase.
2. Skopiuj nazwy zmiennych z `.env.example` do lokalnego `.env` i podaj wartości projektu.
3. Uruchom `npm run dev`.

`SUPABASE_SERVICE_ROLE_KEY` jest używany wyłącznie w modułach serwerowych. Przeglądarka nie łączy się bezpośrednio z Supabase ani nie otrzymuje tokenu Supabase.
