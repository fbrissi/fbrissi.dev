@email
Feature: Service emails
  The program sends English service emails from notifications@fbrissi.dev through the outbox and the mailer, with
  one-click unsubscribe. Account notices (ban and restore) ignore the email setting.

  @smoke
  Scenario: the owner gets one digest per group, with the count and nothing about the requester (E1)
    When people ask to join my group
    Then I get one digest with the count and nothing about who asked

  Scenario: a second join request inside 6 hours sends no new digest
    Given I got a digest for my group
    When another person asks to join within 6 hours
    Then no new digest arrives now

  Scenario: requesters learn the decision, and a declined one waits 7 days (E2, E3)
    When the owner approves one request and declines another
    Then each requester gets the decision and the declined one is told to wait 7 days
    And the declined requester sees the rejection and the date to ask again on the group page and in My groups

  Scenario: an owner who turned emails off gets no digest
    Given I turned service emails off
    When someone asks to join my group
    Then I get no digest

  Scenario: approval and rejection emails are not sent to a user who turned emails off
    Given I turned service emails off
    When the owner decides my requests
    Then I get no email

  Scenario: the owner gets the platform admin deletion with the reason (E4)
    When the platform admin deletes my group with a reason
    Then I get an email with the reason

  Scenario: the ban email mentions the 2-year record and arrives even with emails turned off
    Given I turned service emails off
    When the platform admin bans me
    Then I still get the ban email, which mentions the 2-year record and how to contest it at groups@fbrissi.dev
    And it has no List-Unsubscribe header, since unsubscribing would not stop it

  Scenario: the restored email arrives even with emails turned off
    Given I am banned with emails turned off
    When the platform admin lifts the ban
    Then I still get the restored email, without a List-Unsubscribe header

  @smoke
  Scenario: every service email comes from notifications@fbrissi.dev, replies to groups@fbrissi.dev and has English text and HTML parts
    When the program sends me service emails
    Then each comes from notifications@fbrissi.dev with Reply-To groups@fbrissi.dev, a [LOCAL] subject, and English text and HTML parts in the shared email layout
    And each has a one-click List-Unsubscribe header

  Scenario: the one-click unsubscribe POST from a mail provider turns emails off, and the account turns them back on
    When my mail provider posts the one-click unsubscribe
    Then service emails are off, and I can turn them back on in my account

  Scenario: the unsubscribe link in the email opens a confirmation page and changes nothing until confirmed
    When I open the unsubscribe link from an email
    Then I see a confirmation page and nothing changes until I confirm

  Scenario: a tampered unsubscribe link is refused and changes nothing
    When someone posts an unsubscribe link with a changed token
    Then it is refused and my email setting stays on
