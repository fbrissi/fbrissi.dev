@board
Feature: Board, suggestions and rounds
  Members suggest materials; the owner reviews them in review-first mode, runs draw and vote rounds and manages
  content. A platform admin outside the group manages but never participates.

  Background:
    Given a group with an owner and a member

  Scenario: members see the board without owner controls
    When the member opens the board
    Then there are no owner controls

  Scenario: owners see the moderation controls
    When the owner opens the board
    Then the moderation controls are there

  @smoke
  Scenario: members suggest and vote once per round; the owner runs the round
    When the member suggests materials and votes in a round the owner opens and closes
    Then each member has one vote and the round ends with a winner

  Scenario: a vote needs at least 2 open materials (422); a draw needs 1
    Given the board has one open material
    Then a vote round is refused and a draw round works

  Scenario: a draw closes at once with a winner, and only one round is open at a time
    When the owner starts a draw
    Then it closes at once with a winner
    And a second open round is refused while a vote is open

  Scenario: the owner cancels an open vote round and no material wins
    Given a vote round is open
    When the owner cancels it
    Then it closes with no winner and cannot be cancelled again

  Scenario: the owner deletes content; the member cannot
    When the owner and the member try to delete a material
    Then only the owner can, after confirming in the in-page dialog, and a status message confirms it

  Scenario: a member can suggest at most 20 materials per day in a group
    Given the member suggested 20 materials today
    When they suggest one more
    Then it is refused as too many

  Scenario: user text renders as plain text and only http(s) links are accepted
    When someone suggests a material with HTML and a non-http link
    Then the HTML shows as text and the link is refused

  Scenario: in free mode a member suggestion appears right away
    Then a member suggestion is open at once

  Scenario: the owner switches to review mode in the settings
    When the owner turns on review-first mode
    Then the setting is saved

  Scenario: in review mode the author sees the suggestion as pending and other members do not see it
    When a member suggests in review mode
    Then the author sees it pending and other members do not see it

  Scenario: the owner's own suggestions skip review
    When the owner suggests in review mode
    Then it is open at once

  Scenario: the owner sees pending items and approves them
    When the owner approves a pending suggestion
    Then everyone sees it

  Scenario: members cannot approve pending items
    Then a member cannot approve a pending suggestion

  Scenario: switching back to free mode keeps pending items pending and new suggestions go straight in
    When the owner switches back to free mode
    Then pending items stay pending and new ones are open

  Scenario: the owner can reject a pending item by deleting it
    When the owner deletes a pending suggestion
    Then it is gone

  Scenario: a non-member admin cannot suggest or vote (API 403)
    Given the platform admin is not a member
    Then suggesting and voting are refused

  Scenario: the board hides the suggest form and vote buttons from a non-member admin but keeps management
    Given the platform admin is not a member
    When they open the board
    Then they can manage but cannot suggest or vote

  Scenario: an admin who joins the group as a member can suggest and vote
    Given the platform admin joined as a member
    Then they can suggest and vote
