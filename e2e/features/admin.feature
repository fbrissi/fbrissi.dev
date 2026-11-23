@admin
Feature: Platform admin moderation
  The allowlisted platform admin moderates every group with a mandatory reason, bans and restores users, and every
  action lands in the moderation log. Emails are never shown.

  Background:
    Given I am the platform admin

  Scenario: only the allowlisted admin sees the moderation view, which lists every group including unlisted ones
    When I open the moderation view
    Then I see every group, unlisted ones included
    And other users cannot open it

  Scenario: the admin opens any group board and settings without being a member
    When I open a group I am not a member of
    Then I see its board and settings

  Scenario: deleting a material needs a 10–500 character reason (API)
    When I delete a material without a valid reason
    Then it is refused

  Scenario: the admin deletes a material with a reason from the board
    When I delete a material and give a reason in the in-page dialog
    Then a reason shorter than 10 characters is refused inline, and cancelling deletes nothing
    And it is gone, with a status message

  Scenario: the admin deletes a join request message with a reason
    When I delete a join request message with a reason
    Then the message is gone

  Scenario: deleting a join request message logs a neutral label and the text appears nowhere
    When I delete a join request message
    Then the log shows a neutral label and the text appears nowhere

  @email
  Scenario: the admin deletes a whole group with a reason
    When I type the group name and give the reason in the in-page dialog
    Then the group is gone and the moderation page shows a status message

  Scenario: the moderation log lists every deletion newest first with actor, target, label and reason
    When I open the moderation log
    Then it lists every deletion newest first with actor, target, label and reason

  Scenario: the owner sees the admin deletions and reasons in My groups and in the settings (Q5)
    When I delete content from a group
    Then its owner sees the deletion and the reason

  Scenario: deletions are permanent: there is nothing to restore (no soft delete)
    When I delete something
    Then nothing is left to restore

  Scenario: the admin's own group needs no reason (owner role wins)
    When I delete content in a group I own
    Then no reason is asked

  Scenario: an admin deletion is audited and permanent; an owner deletion is not audited
    When the admin and an owner delete content
    Then only the admin deletion is in the log

  @smoke @email
  Scenario: the admin finds the user and bans them with a reason; their groups go and sign-in is refused
    When I search for a user and ban them with a reason
    Then their groups are deleted, their sessions end and they cannot sign in
    And the focus moves to the new Unban button and the moderation log shows "Account banned" right away
    And the ban email tells them how to contest it at groups@fbrissi.dev

  @email
  Scenario: the admin lifts the ban with a reason; the user can sign in again
    When I lift a ban with a reason
    Then the user can sign in again and gets the restored email

  Scenario: renewing a ban keeps the user banned for 2 more years and logs the renewal
    Given a user is banned
    When I renew the ban with a reason
    Then the ban lasts 2 years from now and the log shows the renewal

  Scenario: a platform admin cannot be banned
    When I try to ban a platform admin
    Then it is refused
