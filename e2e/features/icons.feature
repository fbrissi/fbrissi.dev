@icons
Feature: Group icons
  Owners give their group an icon. Icons are checked by content, stored without metadata, served only through
  short-lived signed links inside the app, and never shown on the public pages.

  @smoke
  Scenario: the owner uploads an icon; members see it through a signed link, the public page never
    Given I own a group with a member
    When I upload an icon
    Then the member sees it through a signed link
    And the public landing never shows it

  Scenario Outline: an icon that is <kind> is refused with <status>
    Given I own a group
    When I upload an icon that is <kind>
    Then the upload is refused with status <status>

    Examples:
      | kind                            | status |
      | a GIF                           | 422    |
      | text behind PNG magic bytes     | 422    |
      | sent as SVG                     | 415    |
      | larger than 512 × 512           | 422    |
      | larger than 256 KB              | 413    |

  Scenario: EXIF, GPS and data after the JPEG end are stripped from an uploaded icon
    When I upload a JPEG with EXIF and GPS segments, a comment and data after its end
    Then the served icon has none of them

  Scenario: metadata between progressive JPEG scans is stripped
    When I upload a progressive JPEG with metadata between its scans
    Then the served icon keeps the scans and drops the metadata

  Scenario: tampered, expired, too-long-lived and unsigned icon links are refused; extra query parameters are harmless
    Given a valid signed icon link
    When I change its signature, its expiry or its group, or drop the signature
    Then the link is refused
    And extra query parameters still serve the icon

  Scenario: replacing the icon deletes the old file at once
    When I replace the icon
    Then the old signed link no longer finds a file

  Scenario: a group can change its icon at most 5 times a day
    Given I uploaded 5 icons to the group today
    When I upload another one
    Then it is refused as too many

  Scenario: a platform admin cannot upload an icon to a group they do not own
    When the platform admin uploads an icon to someone else's group
    Then it is refused

  @email
  Scenario: the platform admin removes the icon with a reason; the owner gets a notice and an email
    When the platform admin removes a group icon with a reason
    Then the owner sees a notice and gets an email with the reason
