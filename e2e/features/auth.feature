@auth
Feature: Google sign-in, consent and sessions
  People sign in with Google (the fake IdP locally), accept the Terms, the Privacy Policy and confirm they are 18 or
  older before an account exists, and accept again only after a material policy change.

  Scenario: an unverified Google email is rejected and nothing is stored
    When I sign in with a Google account whose email is not verified
    Then I return to the landing page with a sign-in error
    And no account is stored

  Scenario: a callback without the OAuth cookie or with a wrong state fails generically
    When the sign-in callback arrives without my sign-in cookie or with a wrong state
    Then sign-in fails with the same generic error

  Scenario: the session cookie is __Host-, HttpOnly, Secure, SameSite=Lax and hidden from JavaScript
    When I sign in
    Then the session cookie is __Host- prefixed, HttpOnly, Secure and SameSite=Lax
    And page scripts cannot read it

  Scenario: the post-sign-in redirect only accepts program pages
    When I start sign-in with a return address outside the program
    Then I land on my groups instead

  @smoke
  Scenario: boxes are never pre-checked, all three are required, and declining keeps nothing
    Given I signed in with a new Google account
    When I open the welcome page
    Then the Terms, Privacy Policy and age boxes are unchecked
    And I cannot continue until all three are checked
    And declining stores nothing

  Scenario: a returning user skips the welcome page
    Given I already have an account
    When I sign in again
    Then I go straight to where I started

  Scenario: the welcome page without a pending sign-up says the sign-in expired
    When I open the welcome page without signing in
    Then it says the sign-in expired

  Scenario: signing out ends the session on the server, so the old cookie stops working
    Given I am signed in
    When I sign out
    Then a request with my old session cookie is treated as signed out

  Scenario: an outdated policy acceptance blocks writes until the user accepts again
    Given the Privacy Policy changed materially after I accepted it
    When I open the app
    Then I am asked to accept again and cannot change anything until I do

  Scenario: an outdated Terms acceptance asks again only for the Terms
    Given only the Terms changed materially after I accepted them
    When I open the app
    Then I am asked to accept the Terms only
