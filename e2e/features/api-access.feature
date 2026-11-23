@api @security
Feature: API access control
  Every study groups API route enforces its minimum role, the CSRF rules and the content type, and never exposes
  another user's email.

  @smoke
  Scenario Outline: <caller> gets the expected status from every API route
    Given I call the API as <caller>
    When I call every API route
    Then each answers with the status in the role and route table

    Examples:
      | caller                 |
      | a visitor              |
      | a forged-cookie caller |
      | a banned user          |
      | a signed-in non-member |
      | a pending requester    |
      | a member               |
      | an owner               |
      | the platform admin     |

  Scenario: the API rejects every owner-only action from a member with 403
    Given I am a member
    When I call each owner-only route
    Then each answers 403

  Scenario: a signed-in non-member gets 403 from every group API and the join screen in the UI (3.4)
    Given I am signed in but not a member
    Then every group route answers 403 and the UI shows the join screen

  Scenario: a visitor gets 401 from the group APIs
    Given I am signed out
    Then the group routes answer 401

  Scenario: state-changing requests need an allowed Origin and a JSON body (CSRF)
    When I send a change with a foreign Origin or a non-JSON body
    Then it is refused

  Scenario: state-changing calls with no Origin, a foreign Origin or a null Origin get 403
    When I send a change with no Origin, a foreign Origin or "null"
    Then each answers 403

  Scenario: non-JSON bodies get 415 and malformed JSON gets 400
    When I send text, a form body, no content type or broken JSON
    Then non-JSON answers 415 and broken JSON answers 400

  Scenario: unknown routes get 404, wrong methods 405 and a visitor never learns whether a group exists
    When I call unknown routes, wrong methods and missing groups
    Then I get 404, 405, and 401 for a visitor whatever the group

  Scenario: no API response exposes another user's email address
    When every role reads every readable route
    Then no response contains another user's email

  Scenario: the public groups list is cacheable and holds only id, name, summary and a signed icon link
    When a visitor reads the public groups list
    Then it is cacheable for 60 seconds, noindex, and has only id, name, summary and a signed icon link or null
