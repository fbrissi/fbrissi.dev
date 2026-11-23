@account
Feature: Account
  Users edit their name, download their data, choose whether to get service emails and delete their account.

  Scenario: the user edits the display name (1–40 characters)
    When I change my display name
    Then names of 1 to 40 characters are accepted

  Scenario: the user downloads a JSON export of their data (LGPD art. 18)
    When I download my data
    Then the file holds my profile, consents, groups, memberships, requests, suggestions and votes, and nobody else's data

  Scenario: the data export includes the email preference and the emails sent
    Given I turned service emails off after receiving one
    When I download my data
    Then it includes my email preference and the emails sent to me

  Scenario: deleting the account warns about owned groups and needs an explicit confirmation (Q8)
    When I start deleting my account
    Then I am warned about my groups and must confirm explicitly

  Scenario: after deletion the owned groups are gone and memberships end
    When I delete my account
    Then my groups are gone and my memberships end

  Scenario: suggestions and votes left in other groups stay, shown as "Former member" (Q7)
    When I delete my account
    Then my suggestions elsewhere stay as "Former member"

  Scenario: signing in again with the same Google account starts a new account
    Given I deleted my account
    When I sign in again
    Then I start a new account
