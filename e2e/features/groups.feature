@groups
Feature: Groups and membership
  Owners create groups; people join with the access code and the owner's approval; owners manage codes, listing,
  members and deletion. Deletions are permanent.

  @smoke
  Scenario: the owner creates a group after confirming the content policy
    Given I am signed in
    When I create a group and confirm the content policy
    Then the group exists and I own it

  Scenario: the landing page card shows only the name and summary (D3)
    When a visitor opens the landing page
    Then each group card shows only its name and summary

  Scenario: signed-out users clicking a card sign in first and land on the join screen (1.2, 3.2)
    Given I am signed out
    When I open a group card
    Then I sign in first and land on its join screen

  Scenario: signed-out users can never submit a code
    Given I am signed out
    When I open a group join screen
    Then there is no access code field to submit

  @smoke
  Scenario: the owner sees the request with the name and message but never the email, and approves it
    Given someone asked to join my group with a message
    When I open the requests
    Then I see their display name and message but never their email
    And I can approve them

  Scenario: the approved member opens the board without the code (3.4)
    Given my request was approved
    When I open the group
    Then I see the board without entering the code

  Scenario: the owner can delete the group after confirming its name (4.5)
    Given I own a group
    When I delete it and type its name to confirm
    Then the group is gone permanently and My groups shows a status message

  Scenario: the owner rotates the code; the old code stops working, members and pending requests stay
    Given my group has members and a pending request
    When I rotate the access code and confirm in the in-page dialog
    Then the old code no longer works and the members and the pending request stay

  Scenario: a member leaves the group and loses access
    Given I am a member
    When I leave the group and confirm in the in-page dialog
    Then I can no longer open its board

  Scenario: the owner cannot leave, only delete the group (Q16)
    Given I own a group
    Then I cannot leave it

  Scenario: the owner removes a member: access ends at once and the content keeps their name (Q7)
    When I remove a member and confirm in the in-page dialog
    Then their access ends at once, a status message confirms it and their suggestions keep their name

  Scenario: an unlisted group disappears from the landing page and comes back when listed again
    When I unlist my group and list it again
    Then it leaves the landing page and comes back

  Scenario: create, edit, unlist, relist and delete are reflected on the landing page
    When I create, edit, unlist, relist and delete a group
    Then the landing page list follows each change

  Scenario: a user owns at most 3 groups and names and summaries respect their limits
    Given I own 3 groups
    When I try to create a fourth or use names and summaries outside the limits
    Then it is refused

  Scenario Outline: the group name "<name>" is refused as a link
    Given I am signed in
    When I create a group named "<name>"
    Then it is refused because group names can't contain links or web addresses

    Examples:
      | name                 |
      | My Group EXAMPLE.COM |
      | Join WWW.club now    |
      | HTTPS://x            |
      | see bit.LY           |
      | Meet at chat.example.museum |
      | Join 10.0.0.1 now    |
      | mailto:owner         |
      | Go.Talk              |

  Scenario Outline: the tech name "<name>" stays allowed
    When I create a group named "<name>"
    Then it is created

    Examples:
      | name           |
      | Node.js devs   |
      | ASP.NET Core   |
      | .NET devs      |
      | Socket.IO chat |

  Scenario: names, summaries and display names with invisible or text-direction characters or an email address are refused
    When I use a zero-width or bidi-override character, or an email address, in a group name, a summary or my display name
    Then it is refused with a plain message

  Scenario: a user can have at most 10 pending join requests
    Given I have 10 pending join requests
    When I ask to join one more group
    Then the request is refused

  Scenario: DevTalk starts unowned and the first allowlisted admin sign-in claims it
    Given the migrated DevTalk group has no owner
    When the allowlisted admin signs in for the first time
    Then the admin owns DevTalk
