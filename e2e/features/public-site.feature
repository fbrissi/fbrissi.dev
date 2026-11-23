# Source of truth for the public site behaviour. Each scenario title is the exact title of a Playwright test under e2e/
# (checked by `yarn e2e:features`); a Scenario Outline matches one test per Examples row.
@public
Feature: Public bilingual site
  Visitors read the portfolio and the English study groups program pages in English and Portuguese, search engines
  index only the public pages, and old URLs keep working.

  @smoke
  Scenario Outline: <path> is indexable in its language with canonical, hreflang and Open Graph tags
    Given I am a visitor
    When I open "<path>"
    Then the page is in its locale with one main heading
    And it has a canonical URL, hreflang alternates, Open Graph tags and is indexable

    Examples:
      | path            |
      | /               |
      | /pt-br          |
      | /about          |
      | /pt-br/about    |
      | /works          |
      | /pt-br/works    |
      | /projects       |
      | /pt-br/projects |
      | /contact        |
      | /pt-br/contact  |

  @smoke
  Scenario Outline: <path> is indexable with canonical, hreflang and OG metadata
    Given I am a visitor
    When I open the program page "<path>"
    Then it is indexable with a canonical URL, the English and Portuguese alternates and Open Graph tags

    Examples:
      | path                              |
      | /study-groups                     |
      | /study-groups/terms               |
      | /privacy                          |
      | /pt-br/grupos-de-estudo-de-ingles |
      | /pt-br/study-groups/terms         |
      | /pt-br/privacy                    |

  Scenario: the projects page shows the Open Source section with the Kool Dev #542 highlight in both locales
    Given I am a visitor
    When I open the projects page in English and in Portuguese
    Then I see the Open Source section
    And the Kool Dev contribution links to pull request #542

  Scenario: the landing page has the sign-in call to action and links to the policies (1.1)
    Given I am a visitor
    When I open the study groups landing page
    Then I see the sign-in call to action and links to the Terms and the Privacy Policy

  @smoke
  Scenario: the pt-BR landing keeps a Portuguese title, description and notice, with the English page as its content
    Given I am a visitor
    When I open "/pt-br/grupos-de-estudo-de-ingles"
    Then only the title, the description and one notice are in Portuguese
    And the notice says the page is in English on purpose
    And the rest of the page is the English landing that sends me to the English app
    And its Terms and Privacy links open the Portuguese pages and reports go to groups@fbrissi.dev

  Scenario: no Portuguese page links to the old /pt-br/study-groups landing URL
    Given I am a visitor
    When I open the Portuguese pages
    Then none of them links to "/pt-br/study-groups"

  Scenario: the sitemap lists the program pages and no app pages (D1, D2)
    When I read the sitemap
    Then it lists the program pages in both locales
    And it lists no app page

  Scenario Outline: <from> moves permanently to <to>
    When I request "<from>"
    Then I am redirected permanently to "<to>"

    Examples:
      | from                                                       | to                                                              |
      | /study-groups/privacy                                      | /privacy                                                        |
      | /pt-br/study-groups/privacy                                | /pt-br/privacy                                                  |
      | /open-source                                               | /projects#open-source                                           |
      | /pt-br/open-source                                         | /pt-br/projects#open-source                                     |
      | /pt-br/study-groups                                        | /pt-br/grupos-de-estudo-de-ingles                               |
      | /pt-br/articles/registry-lookup-with-digital-certificates | /pt-br/articles/consulta-de-cadastros-com-certificacao-digital |
      | /articles/consulta-de-cadastros-com-certificacao-digital  | /articles/registry-lookup-with-digital-certificates            |

  Scenario: the old board URL redirects permanently to the DevTalk group page
    When I request the retired secret-slug board URL
    Then I am redirected permanently to the DevTalk group page

  Scenario: the old settings URL redirects permanently to the DevTalk settings page
    When I request the retired secret-slug settings URL
    Then I am redirected permanently to the DevTalk settings page

  Scenario: a browser following the old URL lands on the DevTalk page
    When I follow the retired board URL in a browser
    Then I land on the DevTalk page

  Scenario: the generated Cloudflare _redirects uses 301 for the old URLs and 200 rewrites for groups
    When I read the generated _redirects file
    Then old URLs move with 301 and group pages are 200 rewrites to their static shells

  Scenario Outline: <path> loads directly and is noindex, nofollow with no-referrer
    Given I am a visitor
    When I open the app page "<path>" directly
    Then it loads, is marked noindex, nofollow and no-referrer, and has no canonical URL

    Examples:
      | path                             |
      | /study-groups/my                 |
      | /study-groups/new                |
      | /study-groups/account            |
      | /study-groups/welcome            |
      | /study-groups/admin              |
      | /study-groups/unsubscribe        |
      | /study-groups/g/devtalk          |
      | /study-groups/g/devtalk/settings |

  Scenario: Cloudflare headers send noindex and no-referrer for every app shell
    When I read the Cloudflare headers file
    Then every app shell is sent with noindex and no-referrer

  Scenario: the API answers with noindex and no-store
    When I call the study groups API
    Then the response is noindex and no-store

  Scenario Outline: <path> has no horizontal scroll at 375px
    Given I use a 375px wide phone
    When I open "<path>"
    Then the page does not scroll sideways

    Examples:
      | path                              |
      | /                                 |
      | /pt-br                            |
      | /projects                         |
      | /contact                          |
      | /privacy                          |
      | /pt-br/privacy                    |
      | /study-groups                     |
      | /pt-br/grupos-de-estudo-de-ingles |

  Scenario: every page has one h1, a skip link and a privacy notice on the contact form
    When I open the public pages
    Then each has one main heading and a skip link
    And the contact form shows the privacy notice

  Scenario: the contact form has no consent checkbox and links to the privacy policy
    When I open the contact page in each locale
    Then the form has no checkbox and its notice links to the privacy policy in that locale

  @email
  Scenario: a contact form submission reaches the contact inbox
    Given the local contact API and mail catcher are running
    When a visitor sends a message through the contact API
    Then the contact inbox receives it from the site's no-reply address

  Scenario: articles advertise and switch to the translated slug (S-1)
    When I switch the language on an article
    Then I land on the translated article slug

  Scenario: the resume menu works from the keyboard and Escape returns focus to its button (QA-F1)
    When I open the resume menu from the keyboard and press Escape
    Then the menu closes and the focus returns to its button

  Scenario: project bodies open external links in a new tab with noopener and keep lists styled
    When I open a project page
    Then external links open in a new tab without access to the opener

  Scenario: the mobile menu opens with 44px rows
    Given I use a phone
    When I open the menu
    Then every row is at least 44px tall

  Scenario Outline: <path> links to the program from the header and the footer in its locale
    When I open "<path>"
    Then the header and the footer link to the program page of that locale

    Examples:
      | path        |
      | /           |
      | /about      |
      | /pt-br      |
      | /pt-br/about |

  Scenario: the program terms page marks the header item as the current section
    When I open the program terms
    Then the header marks the program item as current

  Scenario: the header nav fits on one row from 1024px
    Given my window is 1024px wide
    Then the header navigation fits on one row

  Scenario: the mobile menu lists the program between Projects and Contact with a 44px row
    Given I use a phone with the Portuguese site
    When I open the menu
    Then the program item sits between Projects and Contact and is at least 44px tall

  Scenario Outline: the <path> home card opens the program
    When I open "<path>" and follow the program card
    Then I reach the program page of that locale

    Examples:
      | path   |
      | /      |
      | /pt-br |

  Scenario: the header marks the current page with aria-current
    When I open a site page
    Then its header item has aria-current

  Scenario: the legacy localStorage keys are cleared on load and other keys are kept
    Given my browser has keys from the old site
    When I open the site
    Then the old keys are removed and other keys stay

  @cookies
  Scenario: is informational, links to the cookie section and stays dismissed
    Given I am a visitor
    When I see the cookie notice and dismiss it
    Then it links to the cookie section of the Privacy Policy and stays dismissed after a reload

  @cookies
  Scenario: is shown in Portuguese on the pt-BR policy pages, and in English on the pt-BR landing and the app pages
    When I open the Portuguese policy pages, the Portuguese landing and an app page
    Then the cookie notice language follows the page content

  @cookies
  Scenario: the privacy policy has the cookie section the notice links to
    When I follow the cookie notice link
    Then the Privacy Policy shows its cookie section
